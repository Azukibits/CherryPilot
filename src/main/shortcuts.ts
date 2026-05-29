// @ts-nocheck
// 全局快捷键服务
// 集中注册和注销主进程截图快捷键。
import { globalShortcut } from 'electron';
import { mainState } from '@/main/state';
import { startRegionCapture } from '@/main/screen-capture';

// 注册全局截图快捷键。
export function registerShortcuts() {
  const captureFromShortcut = () => {
    startRegionCapture().catch((error) => {
      mainState.mainWindow?.webContents.send('screenshot-error', error.message || '截图失败');
    });
  };

  for (const accelerator of [
    'CommandOrControl+`',
    'CommandOrControl+~',
    'CommandOrControl+Shift+`',
    'Ctrl+`',
    'Ctrl+~',
    'Ctrl+Shift+`'
  ]) {
    globalShortcut.register(accelerator, captureFromShortcut);
  }
}

// 应用退出时注销全部全局快捷键。
export function unregisterShortcuts() {
  globalShortcut.unregisterAll();
}

