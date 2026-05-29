// @ts-nocheck
// 附件和项目文件解析服务
// 处理文件选择、PDF/DOCX/文本读取、目录扫描和附件内容截断。
import path from 'node:path';
import fs from 'node:fs/promises';
import { dialog } from 'electron';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';
import {
  DIRECTORY_SKIP_NAMES,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENT_CHARS,
  MAX_DIRECTORY_ATTACHMENT_CHARS,
  MAX_DIRECTORY_DEPTH,
  MAX_DIRECTORY_FILE_CHARS,
  MAX_DIRECTORY_FILES,
  MAX_INGEST_FILES
} from '@/main/entity';
import { mainState } from '@/main/state';

// 打开文件/目录选择框，返回可用于上下文分析的路径。
export async function selectAnalysisSources() {
  const options = {
    title: '选择要分析的文件或项目文件夹',
    properties: ['openFile', 'openDirectory', 'multiSelections'],
    filters: [
      {
        name: '可分析文件',
        extensions: ['pdf', 'docx', 'txt', 'md', 'markdown', 'json', 'csv', 'log', 'xml', 'html', 'css', 'js', 'ts', 'tsx', 'jsx', 'vue', 'py', 'java', 'cpp', 'c', 'h']
      },
      { name: '所有文件', extensions: ['*'] }
    ]
  };
  const result = mainState.mainWindow && !mainState.mainWindow.isDestroyed()
    ? await dialog.showOpenDialog(mainState.mainWindow, options)
    : await dialog.showOpenDialog(options);

  if (result.canceled) {
    return [];
  }

  return result.filePaths || [];
}

function isTextExtension(ext) {
  return [
    '.txt',
    '.md',
    '.markdown',
    '.json',
    '.jsonc',
    '.csv',
    '.log',
    '.xml',
    '.html',
    '.css',
    '.scss',
    '.sass',
    '.less',
    '.js',
    '.jsx',
    '.mjs',
    '.cjs',
    '.ts',
    '.tsx',
    '.mts',
    '.cts',
    '.vue',
    '.svelte',
    '.astro',
    '.py',
    '.java',
    '.cpp',
    '.cc',
    '.cxx',
    '.c',
    '.h',
    '.hpp',
    '.cs',
    '.go',
    '.rs',
    '.php',
    '.rb',
    '.kt',
    '.swift',
    '.sh',
    '.ps1',
    '.sql',
    '.yaml',
    '.yml',
    '.toml',
    '.ini'
  ].includes(ext);
}

function normalizeRelativePath(filePath) {
  return filePath.split(path.sep).join('/');
}

function isDirectorySkipName(name = '') {
  return DIRECTORY_SKIP_NAMES.has(name) || DIRECTORY_SKIP_NAMES.has(name.toLowerCase());
}

function isDirectorySupportedFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return isTextExtension(ext) || ext === '.pdf' || ext === '.docx';
}

async function collectDirectoryFiles(rootPath) {
  const root = path.resolve(rootPath);
  const files = [];
  const tree = [];
  let seenFiles = 0;
  let skippedFiles = 0;
  let skippedDirectories = 0;
  let oversizedFiles = 0;
  let truncated = false;

  async function walk(directory, depth) {
    if (depth > MAX_DIRECTORY_DEPTH) {
      truncated = true;
      return;
    }

    let entries;
    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch {
      skippedDirectories += 1;
      return;
    }

    entries.sort((left, right) => {
      if (left.isDirectory() !== right.isDirectory()) {
        return left.isDirectory() ? -1 : 1;
      }
      return left.name.localeCompare(right.name);
    });

    for (const entry of entries) {
      if (isDirectorySkipName(entry.name) || entry.isSymbolicLink()) {
        if (entry.isDirectory()) {
          skippedDirectories += 1;
        } else {
          skippedFiles += 1;
        }
        continue;
      }

      const fullPath = path.join(directory, entry.name);
      const relative = normalizeRelativePath(path.relative(root, fullPath));
      const indent = '  '.repeat(depth);

      if (entry.isDirectory()) {
        tree.push(`${indent}${entry.name}/`);
        await walk(fullPath, depth + 1);
        continue;
      }

      seenFiles += 1;

      if (!isDirectorySupportedFile(fullPath)) {
        skippedFiles += 1;
        continue;
      }

      let stat;
      try {
        stat = await fs.stat(fullPath);
      } catch {
        skippedFiles += 1;
        continue;
      }

      if (stat.size > MAX_ATTACHMENT_BYTES) {
        oversizedFiles += 1;
        continue;
      }

      tree.push(`${indent}${relative}`);

      if (files.length >= MAX_DIRECTORY_FILES) {
        truncated = true;
        continue;
      }

      files.push({ path: fullPath, relative, size: stat.size });
    }
  }

  await walk(root, 0);
  return { root, files, tree, seenFiles, skippedFiles, skippedDirectories, oversizedFiles, truncated };
}

async function extractSingleFileText(filePath, stat = null) {
  stat = stat || await fs.stat(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const name = path.basename(filePath);

  if (stat.size > MAX_ATTACHMENT_BYTES) {
    throw new Error(`文件过大，最大支持 ${Math.round(MAX_ATTACHMENT_BYTES / 1024 / 1024)} MB`);
  }

  if (ext === '.pdf') {
    const buffer = await fs.readFile(filePath);
    const result = await pdfParse(buffer);
    return { name, path: filePath, type: 'pdf', size: stat.size, text: result.text || '' };
  }

  if (ext === '.docx') {
    const result = await mammoth.extractRawText({ path: filePath });
    return { name, path: filePath, type: 'docx', size: stat.size, text: result.value || '' };
  }

  if (isTextExtension(ext)) {
    const text = await fs.readFile(filePath, 'utf8');
    return { name, path: filePath, type: ext.slice(1) || 'text', size: stat.size, text };
  }

  if (ext === '.doc') {
    throw new Error('暂不支持旧版 .doc，请另存为 .docx 后拖入');
  }

  throw new Error(`暂不支持 ${ext || '该'} 文件类型`);
}

async function extractDirectoryText(rootPath) {
  const summary = await collectDirectoryFiles(rootPath);
  const rootName = path.basename(summary.root) || summary.root;
  const sections = [
    `项目文件夹：${rootName}`,
    `路径：${summary.root}`,
    `已纳入文件：${summary.files.length} 个；扫描文件：${summary.seenFiles} 个；跳过文件：${summary.skippedFiles} 个；跳过目录：${summary.skippedDirectories} 个；过大文件：${summary.oversizedFiles} 个${summary.truncated ? '；内容已按上限截断' : ''}`,
    '',
    '文件树：',
    summary.tree.length > 0 ? summary.tree.join('\n') : '(没有可分析文件)',
    '',
    '文件内容：'
  ];
  let usedChars = sections.join('\n').length;
  let contentTruncated = false;

  for (const file of summary.files) {
    if (usedChars >= MAX_DIRECTORY_ATTACHMENT_CHARS) {
      contentTruncated = true;
      break;
    }

    try {
      const item = await extractSingleFileText(file.path);
      const remaining = MAX_DIRECTORY_ATTACHMENT_CHARS - usedChars;
      const excerpt = String(item.text || '').slice(0, Math.min(MAX_DIRECTORY_FILE_CHARS, remaining));

      if (!excerpt.trim()) {
        continue;
      }

      const block = [
        `--- ${file.relative} ---`,
        excerpt
      ].join('\n');
      sections.push(block);
      usedChars += block.length + 2;

      if (String(item.text || '').length > excerpt.length) {
        contentTruncated = true;
      }
    } catch (error) {
      const block = `--- ${file.relative} ---\n读取失败：${error.message || '未知错误'}`;
      sections.push(block);
      usedChars += block.length + 2;
    }
  }

  if (contentTruncated) {
    sections.push(`内容超过上限，已限制为 ${Math.round(MAX_DIRECTORY_ATTACHMENT_CHARS / 1000)}k 字符以内。`);
  }

  return {
    name: `${rootName} 项目文件夹`,
    path: summary.root,
    type: 'directory',
    size: summary.files.reduce((total, item) => total + item.size, 0),
    fileCount: summary.files.length,
    text: sections.join('\n\n')
  };
}

// 根据文件或目录类型抽取可分析文本。
export async function extractFileText(filePath) {
  const stat = await fs.stat(filePath);

  if (stat.isDirectory()) {
    return extractDirectoryText(filePath);
  }

  return extractSingleFileText(filePath, stat);
}

// 批量读取 renderer 传入的文件路径并生成附件摘要。
export async function ingestFiles(filePaths = []) {
  const results = [];
  const selectedPaths = filePaths.filter(Boolean).slice(0, MAX_INGEST_FILES);

  for (const filePath of selectedPaths) {
    try {
      const item = await extractFileText(filePath);
      const textLimit = item.type === 'directory' ? MAX_DIRECTORY_ATTACHMENT_CHARS : MAX_ATTACHMENT_CHARS;
      results.push({
        ...item,
        id: `${Date.now()}-${results.length}-${item.name}`,
        text: item.text.slice(0, textLimit),
        preview: item.text.slice(0, 260)
      });
    } catch (error) {
      results.push({
        id: `${Date.now()}-${results.length}-${path.basename(filePath)}`,
        name: path.basename(filePath),
        path: filePath,
        error: error.message || '读取失败'
      });
    }
  }

  if (filePaths.filter(Boolean).length > MAX_INGEST_FILES) {
    results.push({
      id: `${Date.now()}-file-limit`,
      name: '文件数量限制',
      error: `一次最多读取 ${MAX_INGEST_FILES} 个文件`
    });
  }

  return results;
}
