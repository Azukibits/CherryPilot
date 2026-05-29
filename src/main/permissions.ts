// @ts-nocheck
// 权限策略
// 集中管理 Electron session 权限，避免权限逻辑散落在生命周期代码里。
import { session } from 'electron';
import { mainState } from '@/main/state';

// 只允许主窗口申请麦克风/媒体权限。
export function configurePermissions() {
  const allowMedia = (_webContents, permission) => permission === 'media' || permission === 'microphone';

  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(Boolean(mainState.mainWindow && webContents === mainState.mainWindow.webContents && allowMedia(webContents, permission)));
  });

  session.defaultSession.setPermissionCheckHandler((webContents, permission) => (
    Boolean(mainState.mainWindow && webContents === mainState.mainWindow.webContents && allowMedia(webContents, permission))
  ));
}
