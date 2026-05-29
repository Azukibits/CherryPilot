// @ts-nocheck
// 自动更新服务
// 读取更新配置并把检查、下载、错误状态转发给渲染层。
import fs from 'node:fs/promises';
import { app } from 'electron';
import { autoUpdater } from 'electron-updater';
import { UPDATE_CHECK_INTERVAL_MS, UPDATE_CONFIG_PATH } from '@/main/entity';
import { mainState } from '@/main/state';

function sendUpdateStatus(payload) {
  if (mainState.mainWindow && !mainState.mainWindow.isDestroyed()) {
    mainState.mainWindow.webContents.send('update-status', payload);
  }
}

async function readUpdateConfig() {
  try {
    const raw = await fs.readFile(UPDATE_CONFIG_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

// 配置打包环境下的自动更新源和更新状态事件。
export async function configureAutoUpdates() {
  if (!app.isPackaged) {
    return;
  }

  const config = await readUpdateConfig();
  const feedUrl = String(process.env.CHERRYPILOT_UPDATE_URL || config.url || '').trim().replace(/\/+$/, '');

  if (!feedUrl) {
    sendUpdateStatus({ state: 'disabled', message: 'Auto update feed is not configured.' });
    return;
  }

  autoUpdater.setFeedURL({
    provider: 'generic',
    url: feedUrl
  });
  autoUpdater.autoDownload = config.autoDownload !== false;
  autoUpdater.autoInstallOnAppQuit = config.autoInstallOnAppQuit !== false;
  autoUpdater.allowPrerelease = Boolean(config.allowPrerelease);

  autoUpdater.on('checking-for-update', () => {
    sendUpdateStatus({ state: 'checking', message: 'Checking for updates...' });
  });
  autoUpdater.on('update-available', (info) => {
    sendUpdateStatus({ state: 'available', version: info.version, message: `Update ${info.version} is available.` });
  });
  autoUpdater.on('update-not-available', (info) => {
    sendUpdateStatus({ state: 'current', version: info.version, message: 'CherryPilot is up to date.' });
  });
  autoUpdater.on('download-progress', (progress) => {
    sendUpdateStatus({
      state: 'downloading',
      percent: Math.round(Number(progress.percent || 0)),
      message: `Downloading update ${Math.round(Number(progress.percent || 0))}%...`
    });
  });
  autoUpdater.on('update-downloaded', (info) => {
    sendUpdateStatus({
      state: 'downloaded',
      version: info.version,
      message: `Update ${info.version} downloaded. It will be installed when CherryPilot exits.`
    });
  });
  autoUpdater.on('error', (error) => {
    sendUpdateStatus({ state: 'error', message: error.message || 'Update check failed.' });
  });

  const checkForUpdates = () => {
    autoUpdater.checkForUpdates().catch((error) => {
      sendUpdateStatus({ state: 'error', message: error.message || 'Update check failed.' });
    });
  };

  setTimeout(checkForUpdates, 3000);
  const updateTimer = setInterval(checkForUpdates, UPDATE_CHECK_INTERVAL_MS);
  if (typeof updateTimer.unref === 'function') {
    updateTimer.unref();
  }
}
