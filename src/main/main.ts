// 主进程组合入口
// 业务逻辑已拆到独立模块，这里只保留 Electron 生命周期编排。
import { app, BrowserWindow } from 'electron';
import { applyPerformanceRuntime, refreshActiveWindowTitle, stopContextTimer } from '@/main/active-context';
import { registerIpcHandlers } from '@/main/ipc-handlers';
import { startLanShare, stopLanShare } from '@/main/lan-share';
import { configurePermissions } from '@/main/permissions';
import { readSettings } from '@/main/settings';
import { registerShortcuts, unregisterShortcuts } from '@/main/shortcuts';
import { configureAutoUpdates } from '@/main/updates';
import { createWindow } from '@/main/window-manager';

if (process.platform === 'win32') {
  app.setAppUserModelId('studio.cherry.pilot');
}

// 先注册 IPC，确保 renderer 创建后即可调用 preload 暴露的方法。
registerIpcHandlers();

app.whenReady().then(async () => {
  configurePermissions();
  createWindow();
  configureAutoUpdates().catch(() => null);
  registerShortcuts();
  refreshActiveWindowTitle({ force: true });

  const settings = await readSettings();
  applyPerformanceRuntime(settings);
  if (settings.lanShare?.enabled) {
    startLanShare(settings.lanShare).catch(() => null);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('before-quit', () => {
  unregisterShortcuts();
  stopLanShare().catch(() => null);
  stopContextTimer();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
