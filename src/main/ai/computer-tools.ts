// @ts-nocheck
// AI 电脑权限工具
// 只允许模型在用户授权目录内读写文件、建目录、打开路径和执行白名单命令。
import path from 'node:path';
import fs from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { dialog, shell } from 'electron';
import {
  ALLOWED_WORKSPACE_COMMANDS,
  BLOCKED_OPEN_EXTENSIONS,
  MAX_TOOL_FILE_CHARS,
  MAX_TOOL_OUTPUT_CHARS,
  MAX_WORKSPACE_COMMAND_ARGS,
  WINDOWS_COMMAND_ALIASES
} from '@/main/entity';
import { mainState } from '@/main/state';

// 提供给聊天模型的电脑权限工具声明。
export const COMPUTER_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'list_workspace',
      description: 'List files and folders inside the authorized workspace.',
      parameters: {
        type: 'object',
        properties: {
          dir: { type: 'string', description: 'Workspace-relative folder. Defaults to ".".' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'read_workspace_file',
      description: 'Read a text file inside the authorized workspace.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Workspace-relative file path.' }
        },
        required: ['path']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'write_workspace_file',
      description: 'Create or overwrite a text file inside the authorized workspace.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Workspace-relative file path.' },
          content: { type: 'string', description: 'File content to write.' }
        },
        required: ['path', 'content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'make_workspace_directory',
      description: 'Create a folder inside the authorized workspace.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Workspace-relative folder path.' }
        },
        required: ['path']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'open_workspace_path',
      description: 'Open a file or folder inside the authorized workspace with the computer default app or IDE. Use this after creating source files or projects when the user wants them opened.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Workspace-relative file or folder path.' },
          mode: { type: 'string', enum: ['open', 'reveal'], description: 'Use "open" to launch the default app/IDE, or "reveal" to show the item in File Explorer.' }
        },
        required: ['path']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'run_workspace_command',
      description: 'Run a whitelisted build, test, debug, install, or publish command in the authorized workspace. Shell operators and destructive commands are blocked.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Command line to run. Start with a developer tool such as npm, node, python, git, cmake, cargo, go, dotnet, javac, or java.' },
          cwd: { type: 'string', description: 'Optional workspace-relative working directory.' }
        },
        required: ['command']
      }
    }
  }
];

function getWorkspaceRoot(settings) {
  const root = settings.computerAccess?.workspaceRoot
    ? path.resolve(settings.computerAccess.workspaceRoot)
    : '';

  if (!settings.computerAccess?.enabled || !root) {
    throw new Error('电脑权限未开启，或尚未选择工作目录');
  }

  return root;
}

function resolveWorkspacePath(settings, targetPath = '.') {
  const root = getWorkspaceRoot(settings);
  const resolved = path.resolve(root, String(targetPath || '.'));
  const relative = path.relative(root, resolved);

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('路径超出已授权的工作目录');
  }

  return { root, resolved, relative: relative || '.' };
}

// 限制工具输出长度，避免模型上下文被大文本撑爆。
export function truncateToolOutput(value, limit = MAX_TOOL_OUTPUT_CHARS) {
  const text = String(value || '');
  return text.length > limit ? `${text.slice(0, limit)}\n\n[output truncated]` : text;
}

function parseToolArguments(rawArgs = '{}') {
  try {
    return JSON.parse(rawArgs || '{}');
  } catch {
    return {};
  }
}

function isUnsafeCommand(command = '') {
  return [
    /\brm\s+-rf\b/i,
    /\bremove-item\b/i,
    /\bdel\s+\/[fsq]/i,
    /\brd\s+\/s\b/i,
    /\brmdir\s+\/s\b/i,
    /\bformat\b/i,
    /\bdiskpart\b/i,
    /\bshutdown\b/i,
    /\breboot\b/i,
    /\breg\s+delete\b/i,
    /\bgit\s+reset\s+--hard\b/i
  ].some((pattern) => pattern.test(command));
}

function splitCommandLine(command = '') {
  const input = String(command || '').trim();
  const parts = [];
  let current = '';
  let quote = '';

  if (!input) {
    return parts;
  }

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];

    if (quote) {
      if (char === quote) {
        quote = '';
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      if (current) {
        parts.push(current);
        current = '';
      }
      continue;
    }

    current += char;
  }

  if (quote) {
    throw new Error('命令引号未闭合');
  }

  if (current) {
    parts.push(current);
  }

  return parts;
}

function normalizeWorkspaceCommand(command = '') {
  if (command.length > 600 || /[\r\n]/.test(command) || /[&|;<>()`]/.test(command) || isUnsafeCommand(command)) {
    throw new Error('命令被安全策略拒绝');
  }

  const parts = splitCommandLine(command);
  const executable = parts.shift() || '';
  if (/[\\/]/.test(executable) || path.basename(executable) !== executable) {
    throw new Error('命令不允许指定可执行文件路径');
  }

  const executableExt = path.extname(executable).toLowerCase();
  const commandName = executable.toLowerCase().replace(/\.(cmd|exe|bat)$/i, '');

  if (!/^[a-z0-9._+-]+$/i.test(commandName) || !ALLOWED_WORKSPACE_COMMANDS.has(commandName)) {
    throw new Error(`命令不在允许列表中：${commandName || 'unknown'}`);
  }

  if (['.bat', '.cmd'].includes(executableExt) && !WINDOWS_COMMAND_ALIASES[commandName]) {
    throw new Error('不允许直接执行批处理命令');
  }

  if (parts.length > MAX_WORKSPACE_COMMAND_ARGS || parts.some((item) => item.length > 300 || /[\r\n&|;<>()`]/.test(item))) {
    throw new Error('命令参数被安全策略拒绝');
  }

  const finalExecutable = process.platform === 'win32'
    ? WINDOWS_COMMAND_ALIASES[commandName] || executable
    : executable;

  return {
    executable: finalExecutable,
    commandName,
    args: parts
  };
}

async function runWorkspaceCommand(settings, args = {}) {
  if (!settings.computerAccess?.allowCommands) {
    throw new Error('命令执行权限未开启');
  }

  const command = String(args.command || '').trim();
  if (!command) {
    throw new Error('命令不能为空');
  }

  const normalized = normalizeWorkspaceCommand(command);

  const { resolved: cwd } = resolveWorkspacePath(settings, args.cwd || '.');

  return new Promise((resolve) => {
    execFile(normalized.executable, normalized.args, {
      cwd,
      windowsHide: true,
      timeout: 120000,
      maxBuffer: 1024 * 1024
    }, (error, stdout, stderr) => {
      resolve({
        ok: !error,
        command,
        executable: normalized.commandName,
        args: normalized.args,
        cwd,
        exitCode: typeof error?.code === 'number' ? error.code : 0,
        stdout: truncateToolOutput(stdout),
        stderr: truncateToolOutput(stderr),
        error: error ? String(error.message || error) : ''
      });
    });
  });
}

async function openWorkspacePath(settings, args = {}) {
  const { resolved, relative } = resolveWorkspacePath(settings, args.path || '.');
  const stat = await fs.stat(resolved);
  const ext = path.extname(resolved).toLowerCase();

  if (stat.isFile() && BLOCKED_OPEN_EXTENSIONS.has(ext)) {
    throw new Error('出于安全原因，不能直接打开可执行脚本或程序文件');
  }

  if (args.mode === 'reveal') {
    shell.showItemInFolder(resolved);
    return { ok: true, path: relative, mode: 'reveal' };
  }

  const message = await shell.openPath(resolved);
  if (message) {
    throw new Error(message);
  }

  return { ok: true, path: relative, mode: 'open' };
}

// 按工具名执行授权工作区内的文件/命令操作。
export async function executeComputerTool(settings, toolCall = {}) {
  const name = toolCall.function?.name;
  const args = parseToolArguments(toolCall.function?.arguments);

  try {
    if (name === 'list_workspace') {
      const { resolved, relative } = resolveWorkspacePath(settings, args.dir || '.');
      const entries = await fs.readdir(resolved, { withFileTypes: true });
      return {
        ok: true,
        path: relative,
        entries: entries.slice(0, 200).map((entry) => ({
          name: entry.name,
          type: entry.isDirectory() ? 'directory' : 'file'
        }))
      };
    }

    if (name === 'read_workspace_file') {
      const { resolved, relative } = resolveWorkspacePath(settings, args.path);
      const stat = await fs.stat(resolved);
      if (!stat.isFile()) {
        throw new Error('目标不是文件');
      }
      const content = await fs.readFile(resolved, 'utf8');
      return {
        ok: true,
        path: relative,
        size: stat.size,
        content: truncateToolOutput(content, MAX_TOOL_FILE_CHARS)
      };
    }

    if (name === 'write_workspace_file') {
      const { resolved, relative } = resolveWorkspacePath(settings, args.path);
      const content = String(args.content || '');
      if (content.length > MAX_TOOL_FILE_CHARS) {
        throw new Error('写入内容过长');
      }
      await fs.mkdir(path.dirname(resolved), { recursive: true });
      await fs.writeFile(resolved, content, 'utf8');
      return { ok: true, path: relative, bytes: Buffer.byteLength(content, 'utf8') };
    }

    if (name === 'make_workspace_directory') {
      const { resolved, relative } = resolveWorkspacePath(settings, args.path);
      await fs.mkdir(resolved, { recursive: true });
      return { ok: true, path: relative };
    }

    if (name === 'open_workspace_path') {
      return await openWorkspacePath(settings, args);
    }

    if (name === 'run_workspace_command') {
      return await runWorkspaceCommand(settings, args);
    }

    throw new Error(`未知工具：${name || 'unknown'}`);
  } catch (error) {
    return {
      ok: false,
      error: error.message || String(error)
    };
  }
}

// 弹出目录选择框，让用户授权 AI 可访问的工作区。
export async function selectWorkspaceRoot() {
  const options = {
    title: '选择 AI 可访问的工作目录',
    properties: ['openDirectory', 'createDirectory']
  };
  const result = mainState.mainWindow && !mainState.mainWindow.isDestroyed()
    ? await dialog.showOpenDialog(mainState.mainWindow, options)
    : await dialog.showOpenDialog(options);

  if (result.canceled || !result.filePaths?.[0]) {
    return null;
  }

  return result.filePaths[0];
}
