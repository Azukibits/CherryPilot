// @ts-nocheck
const { app, BrowserWindow, desktopCapturer, dialog, globalShortcut, ipcMain, screen, session, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const { execFile } = require('child_process');
const fs = require('fs/promises');
const http = require('http');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { fileURLToPath } = require('url');
const mammoth = require('mammoth');
const pdfParse = require('pdf-parse');

const APP_TITLE = 'CherryPilot';
const PROJECT_ROOT = app.isPackaged ? app.getAppPath() : path.resolve(__dirname, '..');
const SOURCE_ROOT = path.join(PROJECT_ROOT, 'src');
const RENDERER_DIST = path.join(PROJECT_ROOT, 'dist-renderer');
const PRELOAD_PATH = path.join(__dirname, 'preload.cjs');
const CAPTURE_PRELOAD_PATH = path.join(__dirname, 'capture-preload.cjs');
const APP_ICON = path.join(SOURCE_ROOT, 'assets', 'cherrypilot.png');
const UPDATE_CONFIG_PATH = path.join(SOURCE_ROOT, 'update-config.json');
const DEFAULT_PROVIDERS = [
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
const LAST_PROVIDER_INDEX = DEFAULT_PROVIDERS.length - 1;

const DEFAULT_SETTINGS = {
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
const WINDOW_SIZES = {
  expanded: { width: 520, height: 700, minWidth: 460, minHeight: 600 },
  compactIcon: { width: 52, height: 52 },
  compactHover: { width: 570, height: 238 }
};
const COMPACT_VISIBLE_STRIP = 16;
const COMPACT_EDGE_MARGIN = 12;
const COMPACT_SNAP_DISTANCE = 18;
const COMPACT_REVEAL_LEFT_OFFSET = 124;
const COMPACT_REVEAL_TOP_OFFSET = 50;
const COMPACT_EXTERNAL_BLUR_HIDE_MS = 80;
const COMPACT_TOPMOST_RESTORE_MS = 1800;
const CONTEXT_POLL_INTERVAL_MS = 15000;
const CONTEXT_REFRESH_MIN_GAP_MS = 4500;
const UPDATE_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;
const CAPTURE_SETTLE_MS = 90;
const MAX_ATTACHMENT_CHARS = 18000;
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;
const MAX_INGEST_FILES = 12;
const MAX_LAN_BODY_BYTES = 12 * 1024 * 1024;
const MAX_LAN_FILES = 8;
const MAX_TOOL_ITERATIONS = 8;
const MAX_TOOL_OUTPUT_CHARS = 24000;
const MAX_TOOL_FILE_CHARS = 120000;
const MAX_WORKSPACE_COMMAND_ARGS = 32;
const ALLOWED_WORKSPACE_COMMANDS = new Set([
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
const WINDOWS_COMMAND_ALIASES = {
  npm: 'npm.cmd',
  npx: 'npx.cmd',
  pnpm: 'pnpm.cmd',
  yarn: 'yarn.cmd',
  pip: 'pip.exe',
  pip3: 'pip3.exe'
};
const BLOCKED_OPEN_EXTENSIONS = new Set([
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

let mainWindow;
let captureWindow;
let contextTimer;
let currentContextPollInterval = 0;
let compactExternalBlurTimer = null;
let compactTopmostRestoreTimer = null;
let lanShareServer = null;
let lanShareState = null;
let contextRefreshInFlight = null;
let lastContextRefreshAt = 0;
let windowMode = 'expanded';
let compactDragState = null;
let compactDockSide = 'right';
let compactRevealed = false;
let compactDocked = false;
let compactAnswerZoomed = false;
let compactAnswerRestoreState = null;
let currentCapture = null;
let lastExternalContext = {
  title: '等待外部窗口',
  checkedAt: null
};

if (process.platform === 'win32') {
  app.setAppUserModelId('studio.cherry.pilot');
}

function isAppFileUrl(rawUrl = '') {
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

function hardenWindow(window) {
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => {
    if (!isAppFileUrl(url)) {
      event.preventDefault();
    }
  });
}

function fitBoundsToDisplay(bounds) {
  const workArea = screen.getDisplayMatching(bounds).workArea;
  const width = Math.min(bounds.width, workArea.width);
  const height = Math.min(bounds.height, workArea.height);

  return {
    x: Math.min(Math.max(bounds.x, workArea.x), workArea.x + workArea.width - width),
    y: Math.min(Math.max(bounds.y, workArea.y), workArea.y + workArea.height - height),
    width,
    height
  };
}

function getCompactSize() {
  return compactRevealed ? WINDOW_SIZES.compactHover : WINDOW_SIZES.compactIcon;
}

function clampCompactY(y, display, height) {
  return Math.min(
    Math.max(y, display.workArea.y + COMPACT_EDGE_MARGIN),
    display.workArea.y + display.workArea.height - height - COMPACT_EDGE_MARGIN
  );
}

function getCompactBounds({ revealed = compactRevealed, docked = compactDocked, y } = {}) {
  const size = revealed ? WINDOW_SIZES.compactHover : WINDOW_SIZES.compactIcon;
  const current = mainWindow?.getBounds() || { x: 0, y: 0, width: size.width, height: size.height };
  const display = screen.getDisplayMatching({
    x: current.x,
    y: typeof y === 'number' ? y : current.y,
    width: size.width,
    height: size.height
  });
  const workArea = display.workArea;
  const nextY = clampCompactY(typeof y === 'number' ? y : current.y, display, size.height);

  if (docked && !revealed) {
    return {
      x: compactDockSide === 'left'
        ? workArea.x - size.width + COMPACT_VISIBLE_STRIP
        : workArea.x + workArea.width - COMPACT_VISIBLE_STRIP,
      y: nextY,
      width: size.width,
      height: size.height
    };
  }

  if (docked && revealed) {
    return {
      x: compactDockSide === 'left'
        ? workArea.x
        : workArea.x + workArea.width - size.width,
      y: nextY,
      width: size.width,
      height: size.height
    };
  }

  if (compactDockSide === 'left') {
    return {
      x: workArea.x + COMPACT_EDGE_MARGIN,
      y: nextY,
      width: size.width,
      height: size.height
    };
  }

  return {
    x: workArea.x + workArea.width - size.width - COMPACT_EDGE_MARGIN,
    y: nextY,
    width: size.width,
    height: size.height
  };
}

function getFreeCompactBounds(current) {
  const size = WINDOW_SIZES.compactIcon;
  return fitBoundsToDisplay({
    x: current.x,
    y: current.y,
    width: size.width,
    height: size.height
  });
}

function isNearCompactEdge(bounds) {
  const display = screen.getDisplayMatching(bounds);
  const workArea = display.workArea;
  const leftDistance = Math.abs(bounds.x - workArea.x);
  const rightDistance = Math.abs((workArea.x + workArea.width) - (bounds.x + bounds.width));

  if (leftDistance <= COMPACT_SNAP_DISTANCE || rightDistance <= COMPACT_SNAP_DISTANCE) {
    compactDockSide = leftDistance <= rightDistance ? 'left' : 'right';
    return true;
  }

  return false;
}

function updateCompactDockSide(bounds) {
  const display = screen.getDisplayMatching(bounds);
  const centerX = bounds.x + bounds.width / 2;
  const displayCenterX = display.workArea.x + display.workArea.width / 2;
  compactDockSide = centerX < displayCenterX ? 'left' : 'right';
}

function emitWindowMode() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('window-mode-changed', {
      mode: windowMode,
      dockSide: compactDockSide,
      revealed: compactRevealed,
      docked: compactDocked,
      answerZoomed: compactAnswerZoomed
    });
  }

  return {
    mode: windowMode,
    dockSide: compactDockSide,
    revealed: compactRevealed,
    docked: compactDocked,
    answerZoomed: compactAnswerZoomed
  };
}

function setCompactWindowBounds(bounds, animated = false) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.setMinimumSize(bounds.width, bounds.height);
  mainWindow.setBounds(bounds, process.platform === 'darwin' ? animated : false);
}

function restoreMainWindowTopmost() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.setAlwaysOnTop(true, 'floating');
  mainWindow.moveTop();
}

function pauseMainWindowTopmost() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  clearTimeout(compactTopmostRestoreTimer);
  mainWindow.setAlwaysOnTop(false);
  compactTopmostRestoreTimer = setTimeout(() => {
    compactTopmostRestoreTimer = null;
    restoreMainWindowTopmost();
  }, COMPACT_TOPMOST_RESTORE_MS);

  if (typeof compactTopmostRestoreTimer.unref === 'function') {
    compactTopmostRestoreTimer.unref();
  }
}

function getCompactAnchorBounds(bounds) {
  if (windowMode !== 'compact') {
    return bounds;
  }

  if (compactRevealed) {
    return {
      x: bounds.x + COMPACT_REVEAL_LEFT_OFFSET,
      y: bounds.y + COMPACT_REVEAL_TOP_OFFSET,
      width: WINDOW_SIZES.compactIcon.width,
      height: WINDOW_SIZES.compactIcon.height
    };
  }

  return {
    x: bounds.x,
    y: bounds.y,
    width: WINDOW_SIZES.compactIcon.width,
    height: WINDOW_SIZES.compactIcon.height
  };
}

function consumeCompactAnswerRestoreBounds() {
  if (!compactAnswerZoomed) {
    return null;
  }

  const restore = compactAnswerRestoreState;
  compactAnswerZoomed = false;
  compactAnswerRestoreState = null;

  if (restore) {
    compactDockSide = restore.dockSide;
    compactRevealed = restore.revealed;
    compactDocked = restore.docked;
    return restore.bounds;
  }

  return null;
}

function getCompactAnswerZoomBounds() {
  const current = mainWindow?.getBounds() || { x: 0, y: 0, width: 600, height: 400 };
  const display = screen.getDisplayMatching(current);
  const workArea = display.workArea;
  const width = Math.round(workArea.width * 0.5);
  const height = Math.round(workArea.height * 0.5);

  return {
    x: Math.round(workArea.x + (workArea.width - width) / 2),
    y: Math.round(workArea.y + (workArea.height - height) / 2),
    width,
    height
  };
}

function setCompactAnswerZoom(enabled) {
  if (!mainWindow || mainWindow.isDestroyed() || windowMode !== 'compact') {
    return emitWindowMode();
  }

  if (!enabled) {
    const restoreBounds = consumeCompactAnswerRestoreBounds();
    if (restoreBounds) {
      setCompactWindowBounds(restoreBounds, false);
    }
    return emitWindowMode();
  }

  if (!compactAnswerZoomed) {
    compactAnswerRestoreState = {
      bounds: mainWindow.getBounds(),
      dockSide: compactDockSide,
      revealed: compactRevealed,
      docked: compactDocked
    };
  }

  compactAnswerZoomed = true;
  compactRevealed = true;
  compactDocked = false;
  setCompactWindowBounds(getCompactAnswerZoomBounds(), false);
  return emitWindowMode();
}

function setWindowMode(mode) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return emitWindowMode();
  }

  const restoredBounds = consumeCompactAnswerRestoreBounds();

  if (mode === 'compact') {
    const current = restoredBounds || mainWindow.getBounds();
    compactDragState = null;
    compactDocked = false;
    compactRevealed = false;
    updateCompactDockSide(current);
    windowMode = 'compact';
    mainWindow.setResizable(false);
    if (typeof mainWindow.setHasShadow === 'function') {
      mainWindow.setHasShadow(false);
    }
    setCompactWindowBounds(getFreeCompactBounds(current), false);
    return emitWindowMode();
  }

  const expanded = WINDOW_SIZES.expanded;
  const current = restoredBounds || mainWindow.getBounds();
  const anchor = getCompactAnchorBounds(current);
  windowMode = 'expanded';
  compactDragState = null;
  compactRevealed = false;
  compactDocked = false;
  if (typeof mainWindow.setHasShadow === 'function') {
    mainWindow.setHasShadow(true);
  }
  mainWindow.setResizable(true);
  mainWindow.setMinimumSize(expanded.minWidth, expanded.minHeight);
  mainWindow.setBounds(fitBoundsToDisplay({
    x: anchor.x + anchor.width - expanded.width,
    y: anchor.y,
    width: expanded.width,
    height: expanded.height
  }), false);
  return emitWindowMode();
}

function beginCompactDrag(point = {}) {
  if (!mainWindow || mainWindow.isDestroyed() || windowMode !== 'compact' || compactAnswerZoomed) {
    compactDragState = null;
    return null;
  }

  const current = mainWindow.getBounds();
  const iconX = compactRevealed && !compactDocked
    ? current.x + COMPACT_REVEAL_LEFT_OFFSET
    : current.x;
  const iconY = compactRevealed && !compactDocked
    ? current.y + COMPACT_REVEAL_TOP_OFFSET
    : current.y;
  compactRevealed = false;
  compactDocked = false;
  const iconBounds = fitBoundsToDisplay({
    x: iconX,
    y: iconY,
    width: WINDOW_SIZES.compactIcon.width,
    height: WINDOW_SIZES.compactIcon.height
  });
  setCompactWindowBounds(iconBounds, false);

  compactDragState = {
    startX: Number(point.screenX || 0),
    startY: Number(point.screenY || 0),
    bounds: iconBounds
  };

  emitWindowMode();
  return iconBounds;
}

function dragCompactWindow(point = {}) {
  if (!mainWindow || mainWindow.isDestroyed() || windowMode !== 'compact' || compactAnswerZoomed || !compactDragState) {
    return null;
  }

  const dx = Number(point.screenX || 0) - compactDragState.startX;
  const dy = Number(point.screenY || 0) - compactDragState.startY;
  const bounds = compactDragState.bounds;
  const nextBounds = fitBoundsToDisplay({
    x: bounds.x + dx,
    y: bounds.y + dy,
    width: bounds.width,
    height: bounds.height
  });

  mainWindow.setBounds(nextBounds, false);
  return nextBounds;
}

function endCompactDrag() {
  compactDragState = null;
  return settleCompactWindow();
}

function settleCompactWindow() {
  if (!mainWindow || mainWindow.isDestroyed() || windowMode !== 'compact' || compactAnswerZoomed) {
    return null;
  }

  const bounds = mainWindow.getBounds();
  compactDocked = isNearCompactEdge(bounds);
  compactRevealed = false;
  const nextBounds = compactDocked
    ? getCompactBounds({ revealed: false, docked: true, y: bounds.y })
    : fitBoundsToDisplay({
        x: bounds.x,
        y: bounds.y,
        width: WINDOW_SIZES.compactIcon.width,
        height: WINDOW_SIZES.compactIcon.height
      });

  setCompactWindowBounds(nextBounds, false);
  emitWindowMode();
  return nextBounds;
}

function revealCompactWindow() {
  if (!mainWindow || mainWindow.isDestroyed() || windowMode !== 'compact' || compactDragState || compactAnswerZoomed) {
    return null;
  }

  const bounds = mainWindow.getBounds();
  if (!compactDocked) {
    updateCompactDockSide(bounds);
  }

  compactRevealed = true;
  const nextBounds = compactDocked
    ? getCompactBounds({ revealed: true, docked: true, y: bounds.y })
    : {
        x: bounds.x - COMPACT_REVEAL_LEFT_OFFSET,
        y: bounds.y - COMPACT_REVEAL_TOP_OFFSET,
        width: WINDOW_SIZES.compactHover.width,
        height: WINDOW_SIZES.compactHover.height
      };

  setCompactWindowBounds(nextBounds, false);
  emitWindowMode();
  return nextBounds;
}

function hideCompactTools() {
  if (!mainWindow || mainWindow.isDestroyed() || windowMode !== 'compact' || compactDragState || compactAnswerZoomed) {
    return null;
  }

  const bounds = mainWindow.getBounds();
  const wasRevealed = compactRevealed;
  compactRevealed = false;
  const nextBounds = compactDocked
    ? getCompactBounds({ revealed: false, docked: true, y: bounds.y })
    : fitBoundsToDisplay({
        x: bounds.x + (wasRevealed ? COMPACT_REVEAL_LEFT_OFFSET : 0),
        y: bounds.y + (wasRevealed ? COMPACT_REVEAL_TOP_OFFSET : 0),
        width: WINDOW_SIZES.compactIcon.width,
        height: WINDOW_SIZES.compactIcon.height
      });

  setCompactWindowBounds(nextBounds, false);
  emitWindowMode();
  return nextBounds;
}

function collapseCompactToolsForExternalWindow() {
  clearTimeout(compactExternalBlurTimer);
  compactExternalBlurTimer = setTimeout(() => {
    compactExternalBlurTimer = null;

    if (!mainWindow || mainWindow.isDestroyed() || mainWindow.isFocused()) {
      return;
    }

    if (captureWindow && !captureWindow.isDestroyed()) {
      return;
    }

    if (windowMode !== 'compact' || (!compactRevealed && !compactAnswerZoomed)) {
      return;
    }

    if (compactAnswerZoomed) {
      setCompactAnswerZoom(false);
    }

    hideCompactTools();
    pauseMainWindowTopmost();
  }, COMPACT_EXTERNAL_BLUR_HIDE_MS);

  if (typeof compactExternalBlurTimer.unref === 'function') {
    compactExternalBlurTimer.unref();
  }
}

function startContextTimer(intervalMs = CONTEXT_POLL_INTERVAL_MS) {
  if (contextTimer) {
    clearInterval(contextTimer);
  }

  currentContextPollInterval = intervalMs;
  contextTimer = setInterval(() => {
    refreshActiveWindowTitle();
  }, intervalMs);

  if (typeof contextTimer.unref === 'function') {
    contextTimer.unref();
  }
}

function applyPerformanceRuntime(settings = {}) {
  const lowCpuMode = settings.performance?.lowCpuMode !== false;
  const intervalMs = lowCpuMode ? CONTEXT_POLL_INTERVAL_MS : 6000;

  if (currentContextPollInterval !== intervalMs) {
    startContextTimer(intervalMs);
  }
}

function createWindow() {
  const expanded = WINDOW_SIZES.expanded;

  mainWindow = new BrowserWindow({
    width: expanded.width,
    height: expanded.height,
    minWidth: expanded.minWidth,
    minHeight: expanded.minHeight,
    title: APP_TITLE,
    icon: APP_ICON,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: true,
    resizable: true,
    show: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    webPreferences: {
      preload: PRELOAD_PATH,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false,
      spellcheck: false
    }
  });

  hardenWindow(mainWindow);
  mainWindow.setAlwaysOnTop(true, 'floating');
  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile(path.join(RENDERER_DIST, 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    emitWindowMode();
  });

  mainWindow.webContents.once('did-finish-load', () => {
    emitWindowMode();
  });

  mainWindow.on('blur', () => {
    collapseCompactToolsForExternalWindow();
    setTimeout(() => {
      refreshActiveWindowTitle();
    }, 250);
  });

  mainWindow.on('focus', () => {
    clearTimeout(compactExternalBlurTimer);
    clearTimeout(compactTopmostRestoreTimer);
    compactExternalBlurTimer = null;
    compactTopmostRestoreTimer = null;
    restoreMainWindowTopmost();
  });

  startContextTimer(CONTEXT_POLL_INTERVAL_MS);
}

function sendUpdateStatus(payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-status', payload);
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

async function configureAutoUpdates() {
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

function configurePermissions() {
  const allowMedia = (_webContents, permission) => permission === 'media' || permission === 'microphone';

  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(Boolean(mainWindow && webContents === mainWindow.webContents && allowMedia(webContents, permission)));
  });

  session.defaultSession.setPermissionCheckHandler((webContents, permission) => (
    Boolean(mainWindow && webContents === mainWindow.webContents && allowMedia(webContents, permission))
  ));
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

async function refreshActiveWindowTitle(options = {}) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return lastExternalContext;
  }

  const now = Date.now();
  if (!options.force && now - lastContextRefreshAt < CONTEXT_REFRESH_MIN_GAP_MS) {
    return lastExternalContext;
  }

  if (contextRefreshInFlight) {
    return contextRefreshInFlight;
  }

  lastContextRefreshAt = now;
  contextRefreshInFlight = getActiveWindowTitle()
    .then((rawTitle) => {
      const title = rawTitle.trim();

      if (title && !isCompanionTitle(title)) {
        lastExternalContext = {
          title,
          checkedAt: new Date().toISOString()
        };

        mainWindow?.webContents.send('context-updated', lastExternalContext);
      }

      return lastExternalContext;
    })
    .finally(() => {
      contextRefreshInFlight = null;
    });

  return contextRefreshInFlight;
}

function getSettingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function normalizeProvider(value = {}, index = 0) {
  const defaults = DEFAULT_PROVIDERS[index] || DEFAULT_PROVIDERS[0];
  const baseUrl = String(value.baseUrl || defaults.baseUrl).trim().replace(/\/+$/, '');

  return {
    id: defaults.id,
    label: defaults.label,
    local: Boolean(defaults.local),
    apiKey: String(value.apiKey || '').trim(),
    baseUrl: baseUrl || defaults.baseUrl,
    model: String(value.model || defaults.model || '').trim()
  };
}

function normalizeComputerAccess(value = {}) {
  const workspaceRoot = String(value.workspaceRoot || '').trim();

  return {
    enabled: Boolean(workspaceRoot),
    workspaceRoot,
    allowCommands: Boolean(workspaceRoot && value.allowCommands)
  };
}

function normalizePerformance(value = {}) {
  return {
    lowCpuMode: value.lowCpuMode !== false
  };
}

function normalizeLanShare(value = {}) {
  const port = Math.max(0, Math.min(65535, Number(value.port || 0) || 0));
  const token = String(value.token || '').trim();

  return {
    enabled: Boolean(value.enabled),
    port,
    token
  };
}

function normalizeSettings(value = {}) {
  const theme = ['light', 'dark'].includes(value.theme) ? value.theme : DEFAULT_SETTINGS.theme;
  const activeProviderIndex = Math.min(LAST_PROVIDER_INDEX, Math.max(0, Number(value.activeProviderIndex || 0)));
  const rawProviders = Array.isArray(value.providers) ? value.providers : [];
  const providers = DEFAULT_PROVIDERS.map((defaults, index) => normalizeProvider({
    ...defaults,
    ...(rawProviders[index] || {}),
    ...(index === 0 && rawProviders.length === 0
      ? {
          apiKey: value.apiKey,
          baseUrl: value.baseUrl,
          model: value.model
        }
      : {})
  }, index));
  const chatProvider = providers[0];

  return {
    apiKey: chatProvider.apiKey,
    baseUrl: chatProvider.baseUrl,
    model: chatProvider.model || DEFAULT_SETTINGS.model,
    theme,
    activeProviderIndex,
    providers,
    computerAccess: normalizeComputerAccess(value.computerAccess || DEFAULT_SETTINGS.computerAccess),
    performance: normalizePerformance(value.performance || DEFAULT_SETTINGS.performance),
    lanShare: normalizeLanShare(value.lanShare || DEFAULT_SETTINGS.lanShare)
  };
}

async function readSettings() {
  try {
    const raw = await fs.readFile(getSettingsPath(), 'utf8');
    return normalizeSettings(JSON.parse(raw));
  } catch {
    return normalizeSettings(DEFAULT_SETTINGS);
  }
}

async function saveSettings(value) {
  const settings = normalizeSettings(value);
  await fs.mkdir(app.getPath('userData'), { recursive: true });
  await fs.writeFile(getSettingsPath(), JSON.stringify(settings, null, 2), 'utf8');
  applyPerformanceRuntime(settings);
  return settings;
}

function getStartupSettings() {
  const settings = app.getLoginItemSettings({ path: process.execPath });

  return {
    openAtLogin: Boolean(settings.openAtLogin),
    wasOpenedAtLogin: Boolean(settings.wasOpenedAtLogin),
    executablePath: process.execPath
  };
}

function setStartupSettings(enabled) {
  app.setLoginItemSettings({
    openAtLogin: Boolean(enabled),
    path: process.execPath
  });

  return getStartupSettings();
}

function getLanAddresses() {
  const addresses = [];
  const interfaces = os.networkInterfaces();

  for (const details of Object.values(interfaces)) {
    for (const item of details || []) {
      if (item.family === 'IPv4' && !item.internal) {
        addresses.push(item.address);
      }
    }
  }

  return [...new Set(addresses)];
}

function getLanSharePublicState() {
  if (!lanShareState) {
    return {
      enabled: false,
      port: 0,
      token: '',
      urls: []
    };
  }

  return {
    ...lanShareState,
    urls: getLanAddresses().map((address) => `http://${address}:${lanShareState.port}/?token=${lanShareState.token}`)
  };
}

function sendLanJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  response.end(JSON.stringify(payload));
}

function getLanPage(token) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>CherryPilot LAN Share</title>
<style>
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#0b1016;color:#eef6f6}
main{max-width:720px;margin:0 auto;padding:24px}
h1{font-size:22px;margin:0 0 6px}
p{color:#9eb0bc;line-height:1.5}
textarea,input,button{width:100%;box-sizing:border-box;border-radius:8px;border:1px solid #2e3a45;background:#111922;color:#eef6f6}
textarea{min-height:140px;padding:12px;resize:vertical}
input{padding:10px;margin:12px 0}
button{height:40px;border-color:#43f0ce;background:#174137;color:#a8fff3;font-weight:700}
#status{margin-top:12px;color:#8affea}
</style>
</head>
<body>
<main>
<h1>CherryPilot LAN Share</h1>
<p>Send text or files to the CherryPilot device on this local network. Text-readable files become context for Q&A.</p>
<textarea id="message" placeholder="Notes, question context, links, or shared material"></textarea>
<input id="files" type="file" multiple />
<button id="send">Send to CherryPilot</button>
<div id="status"></div>
</main>
<script>
const token=${JSON.stringify(token)};
const statusEl=document.getElementById('status');
function toBase64(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]||'');reader.onerror=reject;reader.readAsDataURL(file);});}
document.getElementById('send').addEventListener('click',async()=>{try{statusEl.textContent='Preparing...';const files=Array.from(document.getElementById('files').files||[]).slice(0,8);const payload={message:document.getElementById('message').value,files:[]};for(const file of files){if(file.size>8*1024*1024){throw new Error(file.name+' is larger than 8 MB');}payload.files.push({name:file.name,type:file.type,size:file.size,data:await toBase64(file)});}const res=await fetch('/share?token='+encodeURIComponent(token),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const data=await res.json();if(!res.ok)throw new Error(data.error||'Send failed');statusEl.textContent='Sent '+data.count+' item(s).';}catch(error){statusEl.textContent=error.message||'Send failed';}});
</script>
</body>
</html>`;
}

function readLanBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;

    request.on('data', (chunk) => {
      total += chunk.length;
      if (total > MAX_LAN_BODY_BYTES) {
        reject(new Error('Request is too large'));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });

    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    request.on('error', reject);
  });
}

function sanitizeLanFileName(name = 'shared-file') {
  const cleaned = path.basename(String(name || 'shared-file')).replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').slice(0, 120);
  return cleaned || 'shared-file';
}

async function saveLanFile(file = {}) {
  const inbox = path.join(app.getPath('userData'), 'lan-inbox');
  await fs.mkdir(inbox, { recursive: true });

  const safeName = `${Date.now()}-${crypto.randomBytes(3).toString('hex')}-${sanitizeLanFileName(file.name)}`;
  const target = path.join(inbox, safeName);
  const buffer = Buffer.from(String(file.data || ''), 'base64');

  if (buffer.length > MAX_ATTACHMENT_BYTES) {
    throw new Error(`${file.name || 'file'} is larger than 8 MB`);
  }

  await fs.writeFile(target, buffer);
  return target;
}

async function handleLanSharePayload(payload = {}, request) {
  const results = [];
  const from = request.socket.remoteAddress || '';
  const message = String(payload.message || '').trim();

  if (message) {
    results.push({
      id: `${Date.now()}-lan-message`,
      name: 'LAN note',
      type: 'text',
      size: Buffer.byteLength(message, 'utf8'),
      text: message,
      preview: message.slice(0, 260),
      source: 'lan',
      from
    });
  }

  const files = Array.isArray(payload.files) ? payload.files.slice(0, MAX_LAN_FILES) : [];
  for (const file of files) {
    try {
      const savedPath = await saveLanFile(file);
      const item = await extractFileText(savedPath);
      results.push({
        ...item,
        id: `${Date.now()}-${results.length}-${item.name}`,
        name: file.name || item.name,
        text: item.text.slice(0, MAX_ATTACHMENT_CHARS),
        preview: item.text.slice(0, 260),
        source: 'lan',
        from
      });
    } catch (error) {
      results.push({
        id: `${Date.now()}-${results.length}-${sanitizeLanFileName(file?.name)}`,
        name: file?.name || 'LAN file',
        source: 'lan',
        from,
        error: error.message || 'LAN file read failed'
      });
    }
  }

  if (mainWindow && !mainWindow.isDestroyed() && results.length > 0) {
    mainWindow.webContents.send('lan-share-received', {
      receivedAt: new Date().toISOString(),
      from,
      items: results
    });
  }

  return results;
}

async function handleLanRequest(request, response, token) {
  try {
    const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
    const providedToken = url.searchParams.get('token') || '';

    if (providedToken !== token) {
      sendLanJson(response, 403, { ok: false, error: 'Invalid share token' });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/') {
      response.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff'
      });
      response.end(getLanPage(token));
      return;
    }

    if (request.method === 'POST' && url.pathname === '/share') {
      const raw = await readLanBody(request);
      const payload = JSON.parse(raw || '{}');
      const results = await handleLanSharePayload(payload, request);
      sendLanJson(response, 200, { ok: true, count: results.length });
      return;
    }

    sendLanJson(response, 404, { ok: false, error: 'Not found' });
  } catch (error) {
    sendLanJson(response, 400, { ok: false, error: error.message || 'LAN share failed' });
  }
}

async function startLanShare(config = {}) {
  if (lanShareServer && lanShareState) {
    return getLanSharePublicState();
  }

  const token = String(config.token || crypto.randomBytes(12).toString('hex'));
  const requestedPort = Math.max(0, Math.min(65535, Number(config.port || 0) || 0));

  lanShareServer = http.createServer((request, response) => {
    handleLanRequest(request, response, token);
  });

  await new Promise((resolve, reject) => {
    lanShareServer.once('error', reject);
    lanShareServer.listen(requestedPort, '0.0.0.0', () => {
      lanShareServer.off('error', reject);
      resolve();
    });
  });

  const address = lanShareServer.address();
  lanShareState = {
    enabled: true,
    port: typeof address === 'object' && address ? address.port : requestedPort,
    token
  };

  return getLanSharePublicState();
}

async function stopLanShare() {
  const server = lanShareServer;
  lanShareServer = null;
  lanShareState = null;

  if (!server) {
    return getLanSharePublicState();
  }

  await new Promise((resolve) => server.close(() => resolve()));
  return getLanSharePublicState();
}

async function getLanShareStatus() {
  return getLanSharePublicState();
}

async function setLanShareEnabled(enabled) {
  const settings = await readSettings();
  const state = enabled
    ? await startLanShare(settings.lanShare)
    : await stopLanShare();

  settings.lanShare = {
    enabled: state.enabled,
    port: state.port,
    token: state.token
  };
  await saveSettings(settings);
  return state;
}

function getChatCompletionsUrl(baseUrl) {
  const cleaned = String(baseUrl || DEFAULT_SETTINGS.baseUrl).trim().replace(/\/+$/, '');
  return cleaned.endsWith('/chat/completions') ? cleaned : `${cleaned}/chat/completions`;
}

function getModelsUrl(baseUrl) {
  const cleaned = String(baseUrl || DEFAULT_SETTINGS.baseUrl).trim().replace(/\/+$/, '');
  const chatPath = '/chat/completions';
  return cleaned.endsWith(chatPath) ? `${cleaned.slice(0, -chatPath.length)}/models` : `${cleaned}/models`;
}

function isAnthropicBaseUrl(baseUrl) {
  return /anthropic|claude/i.test(String(baseUrl || ''));
}

function isLocalBaseUrl(baseUrl) {
  try {
    const { hostname } = new URL(String(baseUrl || ''));
    return ['127.0.0.1', 'localhost', '::1', '0.0.0.0'].includes(hostname);
  } catch {
    return false;
  }
}

function getAuthHeaders(apiKey, baseUrl) {
  if (isAnthropicBaseUrl(baseUrl)) {
    return apiKey
      ? { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }
      : { 'anthropic-version': '2023-06-01' };
  }

  return apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
}

function getAudioTranscriptionsUrl(baseUrl) {
  const cleaned = String(baseUrl || DEFAULT_SETTINGS.baseUrl).trim().replace(/\/+$/, '');
  const suffixes = [
    '/chat/completions',
    '/responses',
    '/models',
    '/audio/transcriptions'
  ];
  const suffix = suffixes.find((item) => cleaned.endsWith(item));
  const base = suffix ? cleaned.slice(0, -suffix.length) : cleaned;
  return base.endsWith('/audio/transcriptions') ? base : `${base}/audio/transcriptions`;
}

function getImageGenerationsUrl(baseUrl) {
  const cleaned = String(baseUrl || DEFAULT_SETTINGS.baseUrl).trim().replace(/\/+$/, '');
  const chatPath = '/chat/completions';
  const modelsPath = '/models';
  const base = cleaned.endsWith(chatPath)
    ? cleaned.slice(0, -chatPath.length)
    : cleaned.endsWith(modelsPath)
      ? cleaned.slice(0, -modelsPath.length)
      : cleaned;

  return base.endsWith('/images/generations') ? base : `${base}/images/generations`;
}

function normalizeModelList(payload) {
  const rawItems = Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload?.models)
      ? payload.models
      : [];

  return [...new Set(rawItems
    .map((item) => (typeof item === 'string' ? item : item?.id || item?.name))
    .filter(Boolean)
    .map(String))]
    .sort((a, b) => a.localeCompare(b));
}

const COMPUTER_TOOLS = [
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

function truncateToolOutput(value, limit = MAX_TOOL_OUTPUT_CHARS) {
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

async function executeComputerTool(settings, toolCall = {}) {
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

async function selectWorkspaceRoot() {
  const options = {
    title: '选择 AI 可访问的工作目录',
    properties: ['openDirectory', 'createDirectory']
  };
  const result = mainWindow && !mainWindow.isDestroyed()
    ? await dialog.showOpenDialog(mainWindow, options)
    : await dialog.showOpenDialog(options);

  if (result.canceled || !result.filePaths?.[0]) {
    return null;
  }

  return result.filePaths[0];
}

async function listModels(overrides = {}) {
  const settings = await readSettings();
  const rawApiKey = Object.hasOwn(overrides, 'apiKey') ? overrides.apiKey : settings.apiKey;
  const rawBaseUrl = Object.hasOwn(overrides, 'baseUrl') ? overrides.baseUrl : settings.baseUrl;
  const baseUrl = String(rawBaseUrl || process.env.AI_BASE_URL || DEFAULT_SETTINGS.baseUrl).trim();
  const apiKey = String(rawApiKey || (!isLocalBaseUrl(baseUrl) ? process.env.AI_API_KEY || process.env.OPENAI_API_KEY : '') || '').trim();

  if (!apiKey && !isLocalBaseUrl(baseUrl)) {
    throw new Error('请先填写 API Key');
  }

  const response = await fetch(getModelsUrl(baseUrl), {
    method: 'GET',
    headers: {
      ...getAuthHeaders(apiKey, baseUrl),
      'Content-Type': 'application/json'
    }
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = payload.error?.message || `模型列表请求失败：HTTP ${response.status}`;
    throw new Error(message);
  }

  return {
    models: normalizeModelList(payload),
    fetchedAt: new Date().toISOString()
  };
}

function getAudioExtension(mimeType = '') {
  if (mimeType.includes('mp4') || mimeType.includes('m4a')) {
    return 'm4a';
  }
  if (mimeType.includes('ogg')) {
    return 'ogg';
  }
  if (mimeType.includes('wav')) {
    return 'wav';
  }
  return 'webm';
}

function isAudioModelName(model = '') {
  return /whisper|transcribe|transcription|stt|speech[-_ ]?to[-_ ]?text|gpt-4o(?:-mini)?-transcribe/i.test(String(model || ''));
}

function isOpenAIAudioBaseUrl(baseUrl = '') {
  try {
    const { hostname } = new URL(String(baseUrl || ''));
    return /(^|\.)openai\.com$/i.test(hostname) || /openai/i.test(hostname);
  } catch {
    return false;
  }
}

function canUseAudioProvider(provider = {}) {
  return Boolean(
    provider?.baseUrl
    && !isAnthropicBaseUrl(provider.baseUrl)
    && (provider.apiKey || isLocalBaseUrl(provider.baseUrl))
  );
}

function getAudioProviderCandidates(settings) {
  const providers = Array.isArray(settings.providers) ? settings.providers : [];
  const activeProvider = getActiveProvider(settings);
  const settingsProvider = {
    apiKey: settings.apiKey || process.env.AI_API_KEY || process.env.OPENAI_API_KEY,
    baseUrl: settings.baseUrl || process.env.AI_BASE_URL || DEFAULT_SETTINGS.baseUrl,
    model: settings.model
  };
  const pool = [activeProvider, ...providers, settingsProvider].filter(canUseAudioProvider);
  const ordered = [
    ...pool.filter((provider) => isAudioModelName(provider.model)),
    ...pool.filter((provider) => isOpenAIAudioBaseUrl(provider.baseUrl)),
    ...pool
  ];
  const seen = new Set();
  const candidates = [];

  for (const provider of ordered) {
    const key = [
      String(provider.baseUrl || '').trim().replace(/\/+$/, ''),
      String(provider.apiKey || ''),
      String(provider.model || '')
    ].join('\n');

    if (!seen.has(key)) {
      seen.add(key);
      candidates.push(provider);
    }
  }

  return candidates;
}

function getTranscribeModel(provider = {}) {
  if (process.env.AI_TRANSCRIBE_MODEL) {
    return process.env.AI_TRANSCRIBE_MODEL;
  }

  return isAudioModelName(provider.model) ? provider.model : 'whisper-1';
}

async function transcribeAudio(payload = {}) {
  const settings = await readSettings();
  if (!payload.audioBuffer) {
    throw new Error('没有收到语音数据');
  }

  const mimeType = String(payload.mimeType || 'audio/webm');
  const audioBytes = Buffer.from(new Uint8Array(payload.audioBuffer));

  if (audioBytes.length < 1024) {
    throw new Error('语音太短，请重新录制');
  }

  const candidates = getAudioProviderCandidates(settings);

  if (candidates.length === 0) {
    throw new Error('请先配置支持语音识别的接口：Base URL 需要支持 /audio/transcriptions，模型可填 whisper-1 或 gpt-4o-mini-transcribe');
  }

  let lastError = null;

  for (const provider of candidates) {
    const apiKey = String(provider.apiKey || process.env.AI_API_KEY || process.env.OPENAI_API_KEY || '').trim();
    const baseUrl = String(provider.baseUrl || process.env.AI_BASE_URL || DEFAULT_SETTINGS.baseUrl).trim();

    if (!apiKey && !isLocalBaseUrl(baseUrl)) {
      continue;
    }

    const form = new FormData();
    form.append('file', new Blob([audioBytes], { type: mimeType }), `voice.${getAudioExtension(mimeType)}`);
    form.append('model', getTranscribeModel(provider));

    const url = getAudioTranscriptionsUrl(baseUrl);
    const response = await fetch(url, {
      method: 'POST',
      headers: getAuthHeaders(apiKey, baseUrl),
      body: form
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message = result.error?.message || `语音识别失败：HTTP ${response.status}`;
      const error = new Error(message);
      error.statusCode = response.status;
      lastError = error;

      if (response.status === 404) {
        continue;
      }

      throw error;
    }

    const text = String(result.text || '').trim();
    if (!text) {
      throw new Error('语音识别返回为空');
    }

    return {
      text,
      transcribedAt: new Date().toISOString()
    };
  }

  if (lastError?.statusCode === 404) {
    throw new Error('当前接口不支持语音识别（HTTP 404）。请在任一接口配置支持 /audio/transcriptions 的 OpenAI 兼容服务，并将该接口模型填为 whisper-1 或 gpt-4o-mini-transcribe。');
  }

  throw lastError || new Error('请先在接口设置里填写可用于语音识别的 API Key');
}

function getActiveProvider(settings) {
  const activeProviderIndex = Math.min(LAST_PROVIDER_INDEX, Math.max(0, Number(settings.activeProviderIndex || 0)));
  return settings.providers?.[activeProviderIndex] || settings.providers?.[0] || settings;
}

function isImageModelName(model = '') {
  return /image|img|dall|flux|stable|sd|midjourney|gpt-image|seedream|t2i|txt2img|imagen/i.test(String(model || ''));
}

function getImageProvider(settings) {
  const providers = Array.isArray(settings.providers) ? settings.providers : [];
  const imageProvider = providers.find((provider) => (
    provider?.apiKey
    && provider?.baseUrl
    && isImageModelName(provider.model)
  ));

  return imageProvider || getActiveProvider(settings);
}

async function generateImage(payload = {}) {
  const prompt = String(payload.prompt || '').trim();
  if (!prompt) {
    throw new Error('请输入生图提示词');
  }

  const settings = await readSettings();
  const provider = getImageProvider(settings);
  const baseUrl = provider.baseUrl || process.env.AI_IMAGE_BASE_URL || process.env.AI_BASE_URL || DEFAULT_SETTINGS.baseUrl;
  const apiKey = provider.apiKey || (!isLocalBaseUrl(baseUrl) ? process.env.AI_IMAGE_API_KEY || process.env.AI_API_KEY || process.env.OPENAI_API_KEY : '');
  const providerModel = String(provider.model || '').trim();
  const model = String(payload.model || (isImageModelName(providerModel) ? providerModel : '') || process.env.AI_IMAGE_MODEL || 'gpt-image-1').trim();

  if (!apiKey && !isLocalBaseUrl(baseUrl)) {
    throw new Error('请先在主页面配置可用于生图的 API Key');
  }

  const response = await fetch(getImageGenerationsUrl(baseUrl), {
    method: 'POST',
    headers: {
      ...getAuthHeaders(apiKey, baseUrl),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      prompt,
      n: 1,
      size: payload.size || '1024x1024'
    })
  });
  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = result.error?.message || `生图请求失败：HTTP ${response.status}`;
    throw new Error(message);
  }

  const image = Array.isArray(result.data) ? result.data[0] : null;
  const imageDataUrl = image?.b64_json
    ? `data:image/png;base64,${image.b64_json}`
    : String(image?.url || '');

  if (!imageDataUrl) {
    throw new Error('生图接口没有返回图片');
  }

  return {
    imageDataUrl,
    prompt,
    model,
    generatedAt: new Date().toISOString()
  };
}

function delay(duration) {
  return new Promise((resolve) => setTimeout(resolve, duration));
}

function getDisplayCaptureSize(display) {
  const scaleFactor = Number(display.scaleFactor || 1);
  const scaledBounds = {
    width: Math.round(display.bounds.width * scaleFactor),
    height: Math.round(display.bounds.height * scaleFactor)
  };

  return {
    width: Math.max(1, Number(display.size?.width || 0), scaledBounds.width),
    height: Math.max(1, Number(display.size?.height || 0), scaledBounds.height)
  };
}

async function captureDisplay(display, options = {}) {
  const maxWidth = Number(options.maxWidth || 0);
  const sourceSize = getDisplayCaptureSize(display);
  const scale = maxWidth > 0 ? Math.min(1, maxWidth / sourceSize.width) : 1;
  const thumbnailSize = {
    width: Math.round(sourceSize.width * scale),
    height: Math.round(sourceSize.height * scale)
  };
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize
  });
  const displayId = String(display.id);
  const source = sources.find((item) => item.display_id === displayId) || sources[0];

  if (!source || source.thumbnail.isEmpty()) {
    throw new Error('无法获取屏幕截图');
  }

  return source.thumbnail;
}

async function startRegionCapture() {
  if (captureWindow && !captureWindow.isDestroyed()) {
    captureWindow.focus();
    return;
  }

  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()) || screen.getPrimaryDisplay();
  const bounds = display.bounds;

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setOpacity(0);
  }

  currentCapture = {
    display,
    bounds
  };

  captureWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    show: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    fullscreenable: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: CAPTURE_PRELOAD_PATH,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false
    }
  });

  hardenWindow(captureWindow);
  captureWindow.setAlwaysOnTop(true, 'screen-saver');
  captureWindow.loadFile(path.join(RENDERER_DIST, 'capture.html'));
  captureWindow.once('ready-to-show', () => {
    if (!captureWindow || captureWindow.isDestroyed()) {
      return;
    }

    captureWindow.show();
    captureWindow.focus();
    captureWindow.webContents.send('capture:prepare', {
      width: bounds.width,
      height: bounds.height,
      live: true
    });
  });
  captureWindow.on('closed', () => {
    captureWindow = null;
    currentCapture = null;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setOpacity(1);
    }
  });
}

async function completeRegionCapture(rect) {
  if (!currentCapture || !captureWindow || captureWindow.isDestroyed()) {
    return null;
  }

  const raw = {
    x: Number(rect?.x),
    y: Number(rect?.y),
    width: Number(rect?.width),
    height: Number(rect?.height)
  };

  if (!Object.values(raw).every(Number.isFinite)) {
    return null;
  }

  const normalized = {
    x: Math.max(0, Math.min(raw.x, raw.x + raw.width)),
    y: Math.max(0, Math.min(raw.y, raw.y + raw.height)),
    width: Math.abs(raw.width),
    height: Math.abs(raw.height)
  };

  if (normalized.width < 8 || normalized.height < 8) {
    return null;
  }

  const capture = currentCapture;
  const regionWindow = captureWindow;

  try {
    regionWindow.hide();
    await delay(CAPTURE_SETTLE_MS);

    const image = await captureDisplay(capture.display);
    const imageSize = image.getSize();
    const scaleX = imageSize.width / capture.bounds.width;
    const scaleY = imageSize.height / capture.bounds.height;
    const cropRect = {
      x: Math.max(0, Math.min(imageSize.width - 1, Math.round(normalized.x * scaleX))),
      y: Math.max(0, Math.min(imageSize.height - 1, Math.round(normalized.y * scaleY))),
      width: Math.max(1, Math.round(normalized.width * scaleX)),
      height: Math.max(1, Math.round(normalized.height * scaleY))
    };

    cropRect.width = Math.min(cropRect.width, imageSize.width - cropRect.x);
    cropRect.height = Math.min(cropRect.height, imageSize.height - cropRect.y);

    const cropped = image.crop(cropRect);
    const payload = {
      dataUrl: cropped.toDataURL(),
      capturedAt: new Date().toISOString(),
      source: 'region'
    };

    if (!regionWindow.isDestroyed()) {
      regionWindow.close();
    }

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setOpacity(1);
      mainWindow.webContents.send('screenshot-created', payload);
      mainWindow.focus();
    }

    return payload;
  } catch (error) {
    if (!regionWindow.isDestroyed()) {
      regionWindow.close();
    }

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setOpacity(1);
      mainWindow.webContents.send('screenshot-error', error.message || '截图失败');
      mainWindow.focus();
    }

    throw error;
  }
}

function cancelRegionCapture() {
  if (captureWindow && !captureWindow.isDestroyed()) {
    captureWindow.close();
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setOpacity(1);
  }
}

function buildAttachmentText(attachments = []) {
  const valid = attachments.filter((item) => item && item.text);

  if (valid.length === 0) {
    return '附件：无';
  }

  return [
    `附件：${valid.length} 个`,
    ...valid.map((item, index) => [
      `--- 附件 ${index + 1}: ${item.name || '未命名'} ---`,
      String(item.text).slice(0, MAX_ATTACHMENT_CHARS)
    ].join('\n'))
  ].join('\n\n');
}

function buildAnalysisPrompt({ activeTitle, note, attachments }) {
  const titleLine = activeTitle ? `当前窗口标题：${activeTitle}` : '当前窗口标题：未知';
  const noteLine = note ? `用户要求：${note}` : '用户要求：请根据当前截图/附件给出有用结论和下一步建议。';

  return [
    titleLine,
    noteLine,
    buildAttachmentText(attachments),
    '',
    '请用中文回答。优先结合用户要求；如果有截图，请观察截图内容；如果有附件，请总结、提炼重点或按要求分析。',
    '不要编造截图或附件中没有的信息。输出要直接、可执行。'
  ].join('\n');
}

function buildSystemPrompt(settings) {
  const lines = [
    '你是一个常驻桌面的 AI companion，能根据截图、附件和用户要求提供简洁、准确、可执行的中文帮助。'
  ];

  if (settings.computerAccess?.enabled) {
    lines.push(
      '用户已经授权你使用电脑工具。只能在已授权的工作目录内读写文件、创建目录、运行命令。',
      '需要创建代码项目、文档、读取资源、调试或发布时，优先使用工具完成实际操作，然后汇报关键结果。',
      '生成或修改 cpp、py、md、项目目录等文件后，如果用户希望直接打开，请使用工具把授权目录内的目标路径交给系统默认 IDE 或应用打开。',
      '命令工具只接受白名单开发命令，不支持 shell 管道、重定向、拼接命令或危险删除操作。',
      '不要尝试访问授权目录之外的路径；命令执行只用于构建、测试、调试、安装依赖或发布相关任务。'
    );
  }

  return lines.join('\n');
}

async function postChatCompletion(baseUrl, apiKey, body) {
  const response = await fetch(getChatCompletionsUrl(baseUrl), {
    method: 'POST',
    headers: {
      ...getAuthHeaders(apiKey, baseUrl),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = payload.error?.message || `AI 璇锋眰澶辫触锛欻TTP ${response.status}`;
    throw new Error(message);
  }

  return payload;
}

function extractAssistantMessage(payload) {
  const message = payload.choices?.[0]?.message;
  if (!message) {
    throw new Error('AI 杩斿洖涓虹┖');
  }

  return message;
}

async function runChatCompletion({ baseUrl, apiKey, model, messages, settings }) {
  const body = {
    model,
    temperature: 0.2,
    messages
  };

  if (!settings.computerAccess?.enabled) {
    const payload = await postChatCompletion(baseUrl, apiKey, body);
    const message = extractAssistantMessage(payload);
    const content = message.content;

    if (!content) {
      throw new Error('AI 杩斿洖涓虹┖');
    }

    return {
      content,
      model,
      analyzedAt: new Date().toISOString()
    };
  }

  const toolMessages = messages.slice();

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration += 1) {
    const payload = await postChatCompletion(baseUrl, apiKey, {
      ...body,
      messages: toolMessages,
      tools: COMPUTER_TOOLS,
      tool_choice: 'auto'
    });
    const message = extractAssistantMessage(payload);
    const toolCalls = Array.isArray(message.tool_calls) ? message.tool_calls : [];

    if (toolCalls.length === 0) {
      const content = message.content;
      if (!content) {
        throw new Error('AI 杩斿洖涓虹┖');
      }

      return {
        content,
        model,
        analyzedAt: new Date().toISOString()
      };
    }

    toolMessages.push({
      role: 'assistant',
      content: message.content || '',
      tool_calls: toolCalls
    });

    for (const toolCall of toolCalls) {
      const result = await executeComputerTool(settings, toolCall);
      toolMessages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        name: toolCall.function?.name || '',
        content: truncateToolOutput(JSON.stringify(result), MAX_TOOL_OUTPUT_CHARS)
      });
    }
  }

  throw new Error('工具调用次数过多，已停止执行');
}

async function analyzeContext({ imageDataUrl, activeTitle, note, attachments }) {
  if (!imageDataUrl && (!attachments || attachments.length === 0) && !note) {
    throw new Error('请先截图、拖入文件，或输入要求');
  }

  const settings = await readSettings();
  const activeProviderIndex = Math.min(LAST_PROVIDER_INDEX, Math.max(0, Number(settings.activeProviderIndex || 0)));
  const chatProvider = settings.providers?.[activeProviderIndex] || settings.providers?.[0] || settings;
  const baseUrl = chatProvider.baseUrl || process.env.AI_BASE_URL || DEFAULT_SETTINGS.baseUrl;
  const apiKey = chatProvider.apiKey || (!isLocalBaseUrl(baseUrl) ? process.env.AI_API_KEY || process.env.OPENAI_API_KEY : '');
  const model = chatProvider.model || process.env.AI_MODEL || DEFAULT_SETTINGS.model;

  if (!apiKey && !isLocalBaseUrl(baseUrl)) {
    throw new Error('请先在接口设置里填写 API Key');
  }

  const userContent = [
    {
      type: 'text',
      text: buildAnalysisPrompt({ activeTitle, note, attachments })
    }
  ];

  if (imageDataUrl && imageDataUrl.startsWith('data:image/')) {
    userContent.push({
      type: 'image_url',
      image_url: { url: imageDataUrl }
    });
  }

  const messages = [
    {
      role: 'system',
      content: buildSystemPrompt(settings)
    },
    {
      role: 'user',
      content: userContent
    }
  ];

  return runChatCompletion({ baseUrl, apiKey, model, messages, settings });
}

async function analyzeScreenshot(payload) {
  return analyzeContext(payload);
}

function isTextExtension(ext) {
  return ['.txt', '.md', '.markdown', '.json', '.csv', '.log', '.xml', '.html', '.css', '.js', '.ts', '.py', '.java', '.cpp', '.c', '.h'].includes(ext);
}

async function extractFileText(filePath) {
  const stat = await fs.stat(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const name = path.basename(filePath);

  if (stat.isDirectory()) {
    throw new Error('暂不支持拖入文件夹');
  }

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

async function ingestFiles(filePaths = []) {
  const results = [];
  const selectedPaths = filePaths.filter(Boolean).slice(0, MAX_INGEST_FILES);

  for (const filePath of selectedPaths) {
    try {
      const item = await extractFileText(filePath);
      results.push({
        ...item,
        id: `${Date.now()}-${results.length}-${item.name}`,
        text: item.text.slice(0, MAX_ATTACHMENT_CHARS),
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

function registerShortcuts() {
  const captureFromShortcut = () => {
    startRegionCapture().catch((error) => {
      mainWindow?.webContents.send('screenshot-error', error.message || '截图失败');
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
  globalShortcut.unregisterAll();
  stopLanShare().catch(() => null);

  if (contextTimer) {
    clearInterval(contextTimer);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('active-context:get', () => refreshActiveWindowTitle({ force: true }));
ipcMain.handle('screen:select-region', () => startRegionCapture());
ipcMain.handle('screenshot:analyze', (_event, payload) => analyzeScreenshot(payload));
ipcMain.handle('context:analyze', (_event, payload) => analyzeContext(payload));
ipcMain.handle('files:ingest', (_event, payload) => ingestFiles(payload?.paths || []));
ipcMain.handle('settings:get', () => readSettings());
ipcMain.handle('settings:save', (_event, payload) => saveSettings(payload));
ipcMain.handle('startup:get', () => getStartupSettings());
ipcMain.handle('startup:set', (_event, enabled) => setStartupSettings(enabled));
ipcMain.handle('lan-share:get', () => getLanShareStatus());
ipcMain.handle('lan-share:set', (_event, enabled) => setLanShareEnabled(Boolean(enabled)));
ipcMain.handle('permissions:select-workspace', () => selectWorkspaceRoot());
ipcMain.handle('models:list', (_event, payload) => listModels(payload));
ipcMain.handle('voice:transcribe', (_event, payload) => transcribeAudio(payload));
ipcMain.handle('image:generate', (_event, payload) => generateImage(payload));
ipcMain.handle('window:get-mode', () => emitWindowMode());
ipcMain.handle('window:set-mode', (_event, mode) => setWindowMode(mode));
ipcMain.handle('window:compact-drag-start', (_event, point) => beginCompactDrag(point));
ipcMain.handle('window:compact-drag-move', (_event, point) => dragCompactWindow(point));
ipcMain.handle('window:compact-drag-end', () => endCompactDrag());
ipcMain.handle('window:compact-reveal', () => revealCompactWindow());
ipcMain.handle('window:compact-hide-tools', () => hideCompactTools());
ipcMain.handle('window:compact-answer-zoom', (_event, enabled) => setCompactAnswerZoom(Boolean(enabled)));
ipcMain.handle('capture:complete', (_event, rect) => completeRegionCapture(rect));
ipcMain.handle('capture:cancel', () => cancelRegionCapture());

ipcMain.handle('window:minimize', () => {
  mainWindow?.minimize();
});

ipcMain.handle('window:close', () => {
  mainWindow?.close();
});

ipcMain.handle('window:toggle-pin', () => {
  if (!mainWindow) {
    return false;
  }

  const next = !mainWindow.isAlwaysOnTop();
  mainWindow.setAlwaysOnTop(next, 'floating');
  return next;
});
