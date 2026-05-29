// @ts-nocheck
// 外部窗口上下文服务
// 负责读取当前活动窗口标题，并根据性能设置控制轮询频率。
import path from 'node:path';
import { execFile } from 'node:child_process';
import { APP_TITLE, CONTEXT_POLL_INTERVAL_MS, CONTEXT_REFRESH_MIN_GAP_MS, PROJECT_ROOT } from '@/main/entity';
import { mainState } from '@/main/state';

// 启动或重建外部窗口标题轮询定时器。
export function startContextTimer(intervalMs = CONTEXT_POLL_INTERVAL_MS) {
  if (mainState.contextTimer) {
    clearInterval(mainState.contextTimer);
  }

  mainState.currentContextPollInterval = intervalMs;
  mainState.contextTimer = setInterval(() => {
    refreshActiveWindowTitle();
  }, intervalMs);

  if (typeof mainState.contextTimer.unref === 'function') {
    mainState.contextTimer.unref();
  }
}

// 根据低 CPU 模式调整上下文轮询频率。
export function applyPerformanceRuntime(settings = {}) {
  const lowCpuMode = settings.performance?.lowCpuMode !== false;
  const intervalMs = lowCpuMode ? CONTEXT_POLL_INTERVAL_MS : 6000;

  if (mainState.currentContextPollInterval !== intervalMs) {
    startContextTimer(intervalMs);
  }
}

async function getActiveWindowTitle() {
  if (process.platform !== 'win32') {
    return '';
  }

  const scriptPath = path.join(PROJECT_ROOT, 'scripts', 'get-active-window-title.ps1');

  return new Promise((resolve) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath],
      { windowsHide: true, timeout: 3000 },
      (error, stdout) => {
        resolve(error ? '' : stdout.trim());
      }
    );
  });
}

function isCompanionTitle(title) {
  return title === APP_TITLE || title.includes(APP_TITLE);
}

// 读取当前活动窗口标题并推送给渲染层。
export async function refreshActiveWindowTitle(options = {}) {
  if (!mainState.mainWindow || mainState.mainWindow.isDestroyed()) {
    return mainState.lastExternalContext;
  }

  const now = Date.now();
  if (!options.force && now - mainState.lastContextRefreshAt < CONTEXT_REFRESH_MIN_GAP_MS) {
    return mainState.lastExternalContext;
  }

  if (mainState.contextRefreshInFlight) {
    return mainState.contextRefreshInFlight;
  }

  mainState.lastContextRefreshAt = now;
  mainState.contextRefreshInFlight = getActiveWindowTitle()
    .then((rawTitle) => {
      const title = rawTitle.trim();

      if (title && !isCompanionTitle(title)) {
        mainState.lastExternalContext = {
          title,
          checkedAt: new Date().toISOString()
        };

        mainState.mainWindow?.webContents.send('context-updated', mainState.lastExternalContext);
      }

      return mainState.lastExternalContext;
    })
    .finally(() => {
      mainState.contextRefreshInFlight = null;
    });

  return mainState.contextRefreshInFlight;
}

// 应用退出时清理上下文轮询定时器。
export function stopContextTimer() {
  if (mainState.contextTimer) {
    clearInterval(mainState.contextTimer);
    mainState.contextTimer = null;
  }
  mainState.currentContextPollInterval = 0;
}

