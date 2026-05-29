// @ts-nocheck
// 屏幕区域截图服务
// 负责截图覆盖层窗口、屏幕源抓取、区域裁剪和截图事件回传。
import path from 'node:path';
import { BrowserWindow, desktopCapturer, screen } from 'electron';
import { CAPTURE_PRELOAD_PATH, CAPTURE_SETTLE_MS, RENDERER_DIST } from '@/main/entity';
import { mainState } from '@/main/state';
import { hardenWindow } from '@/main/security';

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

// 创建全屏透明覆盖层，开始区域截图选择。
export async function startRegionCapture() {
  if (mainState.captureWindow && !mainState.captureWindow.isDestroyed()) {
    mainState.captureWindow.focus();
    return;
  }

  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()) || screen.getPrimaryDisplay();
  const bounds = display.bounds;

  if (mainState.mainWindow && !mainState.mainWindow.isDestroyed()) {
    mainState.mainWindow.setOpacity(0);
  }

  mainState.currentCapture = {
    display,
    bounds
  };

  mainState.captureWindow = new BrowserWindow({
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

  hardenWindow(mainState.captureWindow);
  mainState.captureWindow.setAlwaysOnTop(true, 'screen-saver');
  mainState.captureWindow.loadFile(path.join(RENDERER_DIST, 'capture.html'));
  mainState.captureWindow.once('ready-to-show', () => {
    if (!mainState.captureWindow || mainState.captureWindow.isDestroyed()) {
      return;
    }

    mainState.captureWindow.show();
    mainState.captureWindow.focus();
    mainState.captureWindow.webContents.send('capture:prepare', {
      width: bounds.width,
      height: bounds.height,
      live: true
    });
  });
  mainState.captureWindow.on('closed', () => {
    mainState.captureWindow = null;
    mainState.currentCapture = null;
    if (mainState.mainWindow && !mainState.mainWindow.isDestroyed()) {
      mainState.mainWindow.setOpacity(1);
    }
  });
}

// 按用户选择区域裁剪屏幕并把截图发回主窗口。
export async function completeRegionCapture(rect) {
  if (!mainState.currentCapture || !mainState.captureWindow || mainState.captureWindow.isDestroyed()) {
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

  const capture = mainState.currentCapture;
  const regionWindow = mainState.captureWindow;

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

    if (mainState.mainWindow && !mainState.mainWindow.isDestroyed()) {
      mainState.mainWindow.setOpacity(1);
      mainState.mainWindow.webContents.send('screenshot-created', payload);
      mainState.mainWindow.focus();
    }

    return payload;
  } catch (error) {
    if (!regionWindow.isDestroyed()) {
      regionWindow.close();
    }

    if (mainState.mainWindow && !mainState.mainWindow.isDestroyed()) {
      mainState.mainWindow.setOpacity(1);
      mainState.mainWindow.webContents.send('screenshot-error', error.message || '截图失败');
      mainState.mainWindow.focus();
    }

    throw error;
  }
}

// 取消截图选择并恢复主窗口透明度。
export function cancelRegionCapture() {
  if (mainState.captureWindow && !mainState.captureWindow.isDestroyed()) {
    mainState.captureWindow.close();
  }

  if (mainState.mainWindow && !mainState.mainWindow.isDestroyed()) {
    mainState.mainWindow.setOpacity(1);
  }
}
