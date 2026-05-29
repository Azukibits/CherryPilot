// @ts-nocheck
// 主窗口初始化与悬浮窗交互
// 集中处理 BrowserWindow 创建、吸边、拖拽、展开收起和置顶恢复。
import path from 'node:path';
import { BrowserWindow, screen } from 'electron';
import {
  APP_ICON,
  APP_TITLE,
  COMPACT_EDGE_MARGIN,
  COMPACT_EXTERNAL_BLUR_HIDE_MS,
  COMPACT_REVEAL_LEFT_OFFSET,
  COMPACT_REVEAL_TOP_OFFSET,
  COMPACT_SNAP_DISTANCE,
  COMPACT_TOPMOST_RESTORE_MS,
  COMPACT_VISIBLE_STRIP,
  CONTEXT_POLL_INTERVAL_MS,
  PRELOAD_PATH,
  RENDERER_DIST,
  WINDOW_SIZES
} from '@/main/entity';
import { mainState } from '@/main/state';
import { refreshActiveWindowTitle, startContextTimer } from '@/main/active-context';
import { hardenWindow } from '@/main/security';

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

  return mainState.compactRevealed ? WINDOW_SIZES.compactHover : WINDOW_SIZES.compactIcon;

}



function clamp(value, min, max) {

  return Math.min(Math.max(value, min), Math.max(min, max));

}



function clampCompactX(x, display, width) {

  const workArea = display.workArea;

  return clamp(

    x,

    workArea.x + COMPACT_EDGE_MARGIN,

    workArea.x + workArea.width - width - COMPACT_EDGE_MARGIN

  );

}



function clampCompactY(y, display, height) {

  const workArea = display.workArea;

  return clamp(

    y,

    workArea.y + COMPACT_EDGE_MARGIN,

    workArea.y + workArea.height - height - COMPACT_EDGE_MARGIN

  );

}



function getCompactBounds({ revealed = mainState.compactRevealed, docked = mainState.compactDocked, x, y } = {}) {

  const size = revealed ? WINDOW_SIZES.compactHover : WINDOW_SIZES.compactIcon;

  const current = mainState.mainWindow?.getBounds() || { x: 0, y: 0, width: size.width, height: size.height };

  const display = screen.getDisplayMatching({

    x: typeof x === 'number' ? x : current.x,

    y: typeof y === 'number' ? y : current.y,

    width: size.width,

    height: size.height

  });

  const workArea = display.workArea;

  const nextX = clampCompactX(typeof x === 'number' ? x : current.x, display, size.width);

  const nextY = clampCompactY(typeof y === 'number' ? y : current.y, display, size.height);

  const dockSide = mainState.compactDockSide;



  if (docked && !revealed) {

    const dockedBounds = {

      left: {

        x: workArea.x - size.width + COMPACT_VISIBLE_STRIP,

        y: nextY

      },

      right: {

        x: workArea.x + workArea.width - COMPACT_VISIBLE_STRIP,

        y: nextY

      },

      top: {

        x: nextX,

        y: workArea.y - size.height + COMPACT_VISIBLE_STRIP

      },

      bottom: {

        x: nextX,

        y: workArea.y + workArea.height - COMPACT_VISIBLE_STRIP

      }

    }[dockSide];

    return {

      ...dockedBounds,

      width: size.width,

      height: size.height

    };

  }



  if (docked && revealed) {

    const revealedBounds = {

      left: {

        x: workArea.x,

        y: nextY

      },

      right: {

        x: workArea.x + workArea.width - size.width,

        y: nextY

      },

      top: {

        x: nextX,

        y: workArea.y

      },

      bottom: {

        x: nextX,

        y: workArea.y + workArea.height - size.height

      }

    }[dockSide];

    return {

      ...revealedBounds,

      width: size.width,

      height: size.height

    };

  }



  if (dockSide === 'left') {

    return {

      x: workArea.x + COMPACT_EDGE_MARGIN,

      y: nextY,

      width: size.width,

      height: size.height

    };

  }



  if (dockSide === 'top') {

    return {

      x: nextX,

      y: workArea.y + COMPACT_EDGE_MARGIN,

      width: size.width,

      height: size.height

    };

  }



  if (dockSide === 'bottom') {

    return {

      x: nextX,

      y: workArea.y + workArea.height - size.height - COMPACT_EDGE_MARGIN,

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



function fitBoundsToVisibleArea(bounds, display) {

  const workArea = display.workArea;

  const minVisibleWidth = Math.min(COMPACT_VISIBLE_STRIP, bounds.width);

  const minVisibleHeight = Math.min(COMPACT_VISIBLE_STRIP, bounds.height);

  return {

    x: clamp(

      Math.round(bounds.x),

      workArea.x - bounds.width + minVisibleWidth,

      workArea.x + workArea.width - minVisibleWidth

    ),

    y: clamp(

      Math.round(bounds.y),

      workArea.y - bounds.height + minVisibleHeight,

      workArea.y + workArea.height - minVisibleHeight

    ),

    width: bounds.width,

    height: bounds.height

  };

}



function getCompactDragBounds(pointer, bounds, offset) {

  const display = screen.getDisplayNearestPoint(pointer) || screen.getDisplayMatching(bounds);

  return fitBoundsToVisibleArea({

    x: pointer.x - offset.x,

    y: pointer.y - offset.y,

    width: bounds.width,

    height: bounds.height

  }, display);

}



function isNearCompactEdge(bounds) {

  const display = screen.getDisplayMatching(bounds);

  const workArea = display.workArea;

  const rightEdge = workArea.x + workArea.width;

  const bottomEdge = workArea.y + workArea.height;

  const distances = [

    { side: 'left', distance: bounds.x <= workArea.x ? 0 : bounds.x - workArea.x },

    { side: 'right', distance: bounds.x + bounds.width >= rightEdge ? 0 : rightEdge - (bounds.x + bounds.width) },

    { side: 'top', distance: bounds.y <= workArea.y ? 0 : bounds.y - workArea.y },

    { side: 'bottom', distance: bounds.y + bounds.height >= bottomEdge ? 0 : bottomEdge - (bounds.y + bounds.height) }

  ];

  const nearest = distances.reduce((best, item) => item.distance < best.distance ? item : best, distances[0]);



  if (nearest.distance <= COMPACT_SNAP_DISTANCE) {

    mainState.compactDockSide = nearest.side;

    return true;

  }



  return false;

}



function updateCompactDockSide(bounds) {

  const display = screen.getDisplayMatching(bounds);

  const workArea = display.workArea;

  const centerX = bounds.x + bounds.width / 2;

  const centerY = bounds.y + bounds.height / 2;

  const distances = [

    { side: 'left', distance: Math.abs(centerX - workArea.x) },

    { side: 'right', distance: Math.abs((workArea.x + workArea.width) - centerX) },

    { side: 'top', distance: Math.abs(centerY - workArea.y) },

    { side: 'bottom', distance: Math.abs((workArea.y + workArea.height) - centerY) }

  ];

  mainState.compactDockSide = distances.reduce((best, item) => item.distance < best.distance ? item : best, distances[0]).side;

}



// 向渲染层广播窗口模式，并返回当前模式快照。
export function emitWindowMode() {

  if (mainState.mainWindow && !mainState.mainWindow.isDestroyed()) {

    mainState.mainWindow.webContents.send('window-mode-changed', {

      mode: mainState.windowMode,

      dockSide: mainState.compactDockSide,

      revealed: mainState.compactRevealed,

      docked: mainState.compactDocked,

      answerZoomed: mainState.compactAnswerZoomed

    });

  }



  return {

    mode: mainState.windowMode,

    dockSide: mainState.compactDockSide,

    revealed: mainState.compactRevealed,

    docked: mainState.compactDocked,

    answerZoomed: mainState.compactAnswerZoomed

  };

}



function setCompactWindowBounds(bounds, animated = false) {

  if (!mainState.mainWindow || mainState.mainWindow.isDestroyed()) {

    return;

  }



  mainState.mainWindow.setMinimumSize(bounds.width, bounds.height);

  mainState.mainWindow.setBounds(bounds, process.platform === 'darwin' ? animated : false);

}



function restoreMainWindowTopmost() {

  if (!mainState.mainWindow || mainState.mainWindow.isDestroyed()) {

    return;

  }



  mainState.mainWindow.setAlwaysOnTop(true, 'floating');

  mainState.mainWindow.moveTop();

}



function pauseMainWindowTopmost() {

  if (!mainState.mainWindow || mainState.mainWindow.isDestroyed()) {

    return;

  }



  clearTimeout(mainState.compactTopmostRestoreTimer);

  mainState.mainWindow.setAlwaysOnTop(false);

  mainState.compactTopmostRestoreTimer = setTimeout(() => {

    mainState.compactTopmostRestoreTimer = null;

    restoreMainWindowTopmost();

  }, COMPACT_TOPMOST_RESTORE_MS);



  if (typeof mainState.compactTopmostRestoreTimer.unref === 'function') {

    mainState.compactTopmostRestoreTimer.unref();

  }

}



function getCompactAnchorBounds(bounds) {

  if (mainState.windowMode !== 'compact') {

    return bounds;

  }



  if (mainState.compactRevealed) {

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

  if (!mainState.compactAnswerZoomed) {

    return null;

  }



  const restore = mainState.compactAnswerRestoreState;

  mainState.compactAnswerZoomed = false;

  mainState.compactAnswerRestoreState = null;



  if (restore) {

    mainState.compactDockSide = restore.dockSide;

    mainState.compactRevealed = restore.revealed;

    mainState.compactDocked = restore.docked;

    return restore.bounds;

  }



  return null;

}



function getCompactAnswerZoomBounds() {

  const current = mainState.mainWindow?.getBounds() || { x: 0, y: 0, width: 600, height: 400 };

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



// 切换悬浮回答放大模式。
export function setCompactAnswerZoom(enabled) {

  if (!mainState.mainWindow || mainState.mainWindow.isDestroyed() || mainState.windowMode !== 'compact') {

    return emitWindowMode();

  }



  if (!enabled) {

    const restoreBounds = consumeCompactAnswerRestoreBounds();

    if (restoreBounds) {

      setCompactWindowBounds(restoreBounds, false);

    }

    return emitWindowMode();

  }



  if (!mainState.compactAnswerZoomed) {

    mainState.compactAnswerRestoreState = {

      bounds: mainState.mainWindow.getBounds(),

      dockSide: mainState.compactDockSide,

      revealed: mainState.compactRevealed,

      docked: mainState.compactDocked

    };

  }



  mainState.compactAnswerZoomed = true;

  mainState.compactRevealed = true;

  mainState.compactDocked = false;

  setCompactWindowBounds(getCompactAnswerZoomBounds(), false);

  return emitWindowMode();

}



// 在展开主窗和悬浮窗之间切换。
export function setWindowMode(mode) {

  if (!mainState.mainWindow || mainState.mainWindow.isDestroyed()) {

    return emitWindowMode();

  }



  const restoredBounds = consumeCompactAnswerRestoreBounds();



  if (mode === 'compact') {

    const current = restoredBounds || mainState.mainWindow.getBounds();

    mainState.compactDragState = null;

    mainState.compactDocked = false;

    mainState.compactRevealed = false;

    updateCompactDockSide(current);

    mainState.windowMode = 'compact';

    mainState.mainWindow.setResizable(false);

    if (typeof mainState.mainWindow.setHasShadow === 'function') {

      mainState.mainWindow.setHasShadow(false);

    }

    setCompactWindowBounds(getFreeCompactBounds(current), false);

    return emitWindowMode();

  }



  const expanded = WINDOW_SIZES.expanded;

  const current = restoredBounds || mainState.mainWindow.getBounds();

  const anchor = getCompactAnchorBounds(current);

  mainState.windowMode = 'expanded';

  mainState.compactDragState = null;

  mainState.compactRevealed = false;

  mainState.compactDocked = false;

  if (typeof mainState.mainWindow.setHasShadow === 'function') {

    mainState.mainWindow.setHasShadow(true);

  }

  mainState.mainWindow.setResizable(true);

  mainState.mainWindow.setMinimumSize(expanded.minWidth, expanded.minHeight);

  mainState.mainWindow.setBounds(fitBoundsToDisplay({

    x: anchor.x + anchor.width - expanded.width,

    y: anchor.y,

    width: expanded.width,

    height: expanded.height

  }), false);

  return emitWindowMode();

}



// 记录悬浮窗拖拽起点并收起工具区。
export function beginCompactDrag(point = {}) {

  if (!mainState.mainWindow || mainState.mainWindow.isDestroyed() || mainState.windowMode !== 'compact' || mainState.compactAnswerZoomed) {

    mainState.compactDragState = null;

    return null;

  }



  const current = mainState.mainWindow.getBounds();

  const iconX = mainState.compactRevealed

    ? current.x + COMPACT_REVEAL_LEFT_OFFSET

    : current.x;

  const iconY = mainState.compactRevealed

    ? current.y + COMPACT_REVEAL_TOP_OFFSET

    : current.y;

  const pointerX = Number(point.screenX || 0);

  const pointerY = Number(point.screenY || 0);

  mainState.compactRevealed = false;

  mainState.compactDocked = false;

  const rawIconBounds = {

    x: iconX,

    y: iconY,

    width: WINDOW_SIZES.compactIcon.width,

    height: WINDOW_SIZES.compactIcon.height

  };

  const dragOffset = {

    x: clamp(pointerX - rawIconBounds.x, 0, rawIconBounds.width),

    y: clamp(pointerY - rawIconBounds.y, 0, rawIconBounds.height)

  };

  const iconBounds = getCompactDragBounds(

    { x: pointerX, y: pointerY },

    rawIconBounds,

    dragOffset

  );

  setCompactWindowBounds(iconBounds, false);



  mainState.compactDragState = {

    startX: pointerX,

    startY: pointerY,

    offsetX: dragOffset.x,

    offsetY: dragOffset.y,

    bounds: iconBounds

  };



  emitWindowMode();

  return iconBounds;

}



// 根据鼠标屏幕坐标移动悬浮窗。
export function dragCompactWindow(point = {}) {
  if (!mainState.mainWindow || mainState.mainWindow.isDestroyed() || mainState.windowMode !== 'compact' || mainState.compactAnswerZoomed || !mainState.compactDragState) {
    return null;
  }
  const dragState = mainState.compactDragState;
  const nextBounds = getCompactDragBounds(
    { x: Number(point.screenX || 0), y: Number(point.screenY || 0) },
    dragState.bounds,
    { x: dragState.offsetX, y: dragState.offsetY }
  );
  mainState.mainWindow.setBounds(nextBounds, false);
  return nextBounds;
}
// 结束拖拽并按边缘距离决定是否吸附。
export function endCompactDrag() {

  mainState.compactDragState = null;

  return settleCompactWindow();

}



function settleCompactWindow() {

  if (!mainState.mainWindow || mainState.mainWindow.isDestroyed() || mainState.windowMode !== 'compact' || mainState.compactAnswerZoomed) {

    return null;

  }



  const bounds = mainState.mainWindow.getBounds();

  mainState.compactDocked = isNearCompactEdge(bounds);

  mainState.compactRevealed = false;

  const nextBounds = mainState.compactDocked

    ? getCompactBounds({ revealed: false, docked: true, x: bounds.x, y: bounds.y })

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



// 展开悬浮窗工具区。
export function revealCompactWindow() {

  if (!mainState.mainWindow || mainState.mainWindow.isDestroyed() || mainState.windowMode !== 'compact' || mainState.compactDragState || mainState.compactAnswerZoomed) {

    return null;

  }



  const bounds = mainState.mainWindow.getBounds();

  if (!mainState.compactDocked) {

    updateCompactDockSide(bounds);

  }



  mainState.compactRevealed = true;

  const nextBounds = mainState.compactDocked

    ? getCompactBounds({ revealed: true, docked: true, x: bounds.x, y: bounds.y })

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



// 收起悬浮窗工具区。
export function hideCompactTools() {

  if (!mainState.mainWindow || mainState.mainWindow.isDestroyed() || mainState.windowMode !== 'compact' || mainState.compactDragState || mainState.compactAnswerZoomed) {

    return null;

  }



  const bounds = mainState.mainWindow.getBounds();

  const wasRevealed = mainState.compactRevealed;

  mainState.compactRevealed = false;

  const nextBounds = mainState.compactDocked

    ? getCompactBounds({ revealed: false, docked: true, x: bounds.x, y: bounds.y })

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

  clearTimeout(mainState.compactExternalBlurTimer);

  mainState.compactExternalBlurTimer = setTimeout(() => {

    mainState.compactExternalBlurTimer = null;



    if (!mainState.mainWindow || mainState.mainWindow.isDestroyed() || mainState.mainWindow.isFocused()) {

      return;

    }



    if (mainState.captureWindow && !mainState.captureWindow.isDestroyed()) {

      return;

    }



    if (mainState.windowMode !== 'compact' || (!mainState.compactRevealed && !mainState.compactAnswerZoomed)) {

      return;

    }



    if (mainState.compactAnswerZoomed) {

      setCompactAnswerZoom(false);

    }



    hideCompactTools();

    pauseMainWindowTopmost();

  }, COMPACT_EXTERNAL_BLUR_HIDE_MS);



  if (typeof mainState.compactExternalBlurTimer.unref === 'function') {

    mainState.compactExternalBlurTimer.unref();

  }

}

// 初始化主窗口并绑定窗口级事件。
export function createWindow() {

  const expanded = WINDOW_SIZES.expanded;



  mainState.mainWindow = new BrowserWindow({

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



  hardenWindow(mainState.mainWindow);

  mainState.mainWindow.setAlwaysOnTop(true, 'floating');

  mainState.mainWindow.setMenuBarVisibility(false);

  mainState.mainWindow.loadFile(path.join(RENDERER_DIST, 'index.html'));


  mainState.mainWindow.once('ready-to-show', () => {

    mainState.mainWindow.show();

    emitWindowMode();

  });



  mainState.mainWindow.webContents.once('did-finish-load', () => {

    emitWindowMode();

  });



  mainState.mainWindow.on('blur', () => {
    // 外部截图工具或系统切窗会抢走焦点；这里同步结束主进程拖拽状态，避免后续 hover 继续移动窗口。
    if (mainState.compactDragState) {
      endCompactDrag();
    }
    collapseCompactToolsForExternalWindow();
    setTimeout(() => {
      refreshActiveWindowTitle();
    }, 250);
  });



  mainState.mainWindow.on('focus', () => {

    clearTimeout(mainState.compactExternalBlurTimer);

    clearTimeout(mainState.compactTopmostRestoreTimer);

    mainState.compactExternalBlurTimer = null;

    mainState.compactTopmostRestoreTimer = null;

    restoreMainWindowTopmost();

  });



  startContextTimer(CONTEXT_POLL_INTERVAL_MS);

}
