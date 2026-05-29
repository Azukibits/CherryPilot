// 窗口安全工具
// 统一限制 Electron 窗口导航范围，所有窗口初始化模块复用这里的校验。
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BrowserWindow } from 'electron';
import { RENDERER_DIST, SOURCE_ROOT } from '@/main/entity';

// 判断 URL 是否指向应用自身允许加载的本地文件。
export function isAppFileUrl(rawUrl = '') {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'file:') {
      return false;
    }

    const filePath = path.resolve(fileURLToPath(parsed));
    const allowedRoots = [RENDERER_DIST, SOURCE_ROOT].map((root) => path.resolve(root));
    return allowedRoots.some((root) => {
      const relative = path.relative(root, filePath);
      return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
    });
  } catch {
    return false;
  }
}

// 禁止窗口跳转到应用资源之外的地址，也禁止新开窗口。
export function hardenWindow(window: BrowserWindow) {
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => {
    if (!isAppFileUrl(url)) {
      event.preventDefault();
    }
  });
}
