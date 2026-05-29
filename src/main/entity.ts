// @ts-nocheck
// 主线程静态数据集中维护
// 窗口尺寸、默认设置、资源路径和安全白名单都从这里导出，避免散落在 main.ts。
import path from 'node:path';
import { app } from 'electron';

// 应用标题和打包/开发环境下的资源路径。
export const APP_TITLE = 'CherryPilot';
export const PROJECT_ROOT = app.isPackaged ? app.getAppPath() : path.resolve(__dirname, '..');
export const SOURCE_ROOT = path.join(PROJECT_ROOT, 'src');
export const RENDERER_DIST = path.join(PROJECT_ROOT, 'dist-renderer');
export const PRELOAD_PATH = path.join(__dirname, 'preload.cjs');
export const CAPTURE_PRELOAD_PATH = path.join(__dirname, 'capture-preload.cjs');
export const APP_ICON = path.join(SOURCE_ROOT, 'assets', 'cherrypilot.png');
export const UPDATE_CONFIG_PATH = path.join(SOURCE_ROOT, 'update-config.json');
// 默认模型接口配置，设置读取时会以这些槽位为基准归一化。
export const DEFAULT_PROVIDERS = [
  {
    id: 'chat',
    label: '接口 1',
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini'
  },
  {
    id: 'slot2',
    label: '接口 2',
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
    model: ''
  },
  {
    id: 'slot3',
    label: '接口 3',
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
    model: ''
  }
];
DEFAULT_PROVIDERS.push({
  id: 'local',
  label: '本地模型',
  apiKey: '',
  baseUrl: 'http://127.0.0.1:11434/v1',
  model: '',
  local: true
});
export const LAST_PROVIDER_INDEX = DEFAULT_PROVIDERS.length - 1;

// 首次启动和设置文件损坏时使用的默认设置。
export const DEFAULT_SETTINGS = {
  apiKey: '',
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini',
  theme: 'dark',
  activeProviderIndex: 0,
  providers: DEFAULT_PROVIDERS,
  computerAccess: {
    enabled: false,
    workspaceRoot: '',
    allowCommands: false
  },
  performance: {
    lowCpuMode: true
  },
  lanShare: {
    enabled: false,
    port: 0,
    token: ''
  }
};
// 展开态、悬浮图标态和悬浮工具态的窗口尺寸。
export const WINDOW_SIZES = {
  expanded: { width: 520, height: 700, minWidth: 460, minHeight: 600 },
  compactIcon: { width: 52, height: 52 },
  compactHover: { width: 570, height: 238 }
};
// 悬浮窗吸边、展开和置顶恢复相关的交互参数。
export const COMPACT_VISIBLE_STRIP = 16;
export const COMPACT_EDGE_MARGIN = 12;
export const COMPACT_SNAP_DISTANCE = 18;
export const COMPACT_REVEAL_LEFT_OFFSET = 124;
export const COMPACT_REVEAL_TOP_OFFSET = 50;
export const COMPACT_EXTERNAL_BLUR_HIDE_MS = 80;
export const COMPACT_TOPMOST_RESTORE_MS = 1800;
// 外部窗口上下文轮询和自动更新的运行间隔。
export const CONTEXT_POLL_INTERVAL_MS = 15000;
export const CONTEXT_REFRESH_MIN_GAP_MS = 4500;
export const UPDATE_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;
// 截图、附件、LAN 分享和工具调用的输入上限。
export const CAPTURE_SETTLE_MS = 90;
export const MAX_ATTACHMENT_CHARS = 18000;
export const MAX_DIRECTORY_ATTACHMENT_CHARS = 90000;
export const MAX_DIRECTORY_FILE_CHARS = 9000;
export const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;
export const MAX_INGEST_FILES = 12;
export const MAX_DIRECTORY_FILES = 80;
export const MAX_DIRECTORY_DEPTH = 8;
export const MAX_LAN_BODY_BYTES = 12 * 1024 * 1024;
export const MAX_LAN_FILES = 8;
export const MAX_TOOL_ITERATIONS = 8;
export const MAX_TOOL_OUTPUT_CHARS = 24000;
export const MAX_TOOL_FILE_CHARS = 120000;
export const MAX_WORKSPACE_COMMAND_ARGS = 32;
// AI 电脑权限允许调用的开发工具白名单。
export const ALLOWED_WORKSPACE_COMMANDS = new Set([
  'node',
  'npm',
  'npx',
  'pnpm',
  'yarn',
  'python',
  'python3',
  'py',
  'pip',
  'pip3',
  'uv',
  'git',
  'cmake',
  'ctest',
  'make',
  'mingw32-make',
  'gcc',
  'g++',
  'clang',
  'clang++',
  'cargo',
  'rustc',
  'go',
  'dotnet',
  'javac',
  'java'
]);
// Windows 下需要走 .cmd/.exe 的命令别名。
export const WINDOWS_COMMAND_ALIASES = {
  npm: 'npm.cmd',
  npx: 'npx.cmd',
  pnpm: 'pnpm.cmd',
  yarn: 'yarn.cmd',
  pip: 'pip.exe',
  pip3: 'pip3.exe'
};
// 禁止直接打开的高风险文件扩展名。
export const BLOCKED_OPEN_EXTENSIONS = new Set([
  '.bat',
  '.cmd',
  '.com',
  '.exe',
  '.lnk',
  '.msi',
  '.ps1',
  '.reg',
  '.scr',
  '.vbs'
]);
// 目录作为附件分析时默认跳过的目录和文件名。
export const DIRECTORY_SKIP_NAMES = new Set([
  '.git',
  '.hg',
  '.svn',
  '.idea',
  '.vscode',
  '.cache',
  '.parcel-cache',
  '.turbo',
  '.next',
  '.nuxt',
  'node_modules',
  'dist',
  'dist-electron',
  'dist-renderer',
  'build',
  'coverage',
  'out',
  'target',
  '__pycache__',
  '.DS_Store',
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock'
]);
