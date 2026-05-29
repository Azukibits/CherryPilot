import {
  AGENT_DOUBLE_TAP_MS,
  AGENT_TAP_DELAY_MS,
  AUTO_COMPACT_AFTER_MS
} from '@/renderer/entity';
import { companionState } from '@/renderer/composables/companionState';

// 清理展开主窗自动收起到悬浮窗的定时器。
export function clearAutoCompact() {
  clearTimeout(companionState.autoCompactTimer);
  companionState.autoCompactTimer = null;
}

// 关闭 provider 下拉菜单，可传 slotIndex 只关闭指定槽位。
export function closeProviderMenus(slotIndex: number | null = null) {
  companionState.providers.forEach((provider, index) => {
    if (slotIndex === null || index === slotIndex) {
      provider.menuOpen = false;
    }
  });
}

// 当鼠标离开且没有锁定主窗时，延迟切回悬浮窗。
export function scheduleAutoCompact() {
  clearAutoCompact();

  if (
    companionState.windowMode !== 'expanded'
    || companionState.pointerInWindow
    || companionState.mainLockedOpen
  ) {
    return;
  }

  companionState.autoCompactTimer = setTimeout(async () => {
    const hasOpenMenu = companionState.providers.some((provider) => provider.menuOpen);

    if (
      companionState.pointerInWindow
      || companionState.mainLockedOpen
      || companionState.isBusy
      || hasOpenMenu
    ) {
      scheduleAutoCompact();
      return;
    }

    const modeState = await window.companion.setWindowMode('compact');
    applyWindowMode(modeState);
  }, AUTO_COMPACT_AFTER_MS);
}

// 主进程负责真实窗口边界，renderer 只镜像界面需要的模式状态。
export function applyWindowMode(nextState: CompanionWindowModeState | string | null | undefined) {
  const modeState: CompanionWindowModeState = typeof nextState === 'string'
    ? { mode: nextState }
    : (nextState || {});

  companionState.windowMode = modeState.mode || 'expanded';
  companionState.answerZoomed = Boolean(modeState.answerZoomed);
  companionState.dockSide = modeState.dockSide || 'right';
  companionState.revealed = Boolean(modeState.revealed);
  companionState.docked = Boolean(modeState.docked);

  if (companionState.windowMode === 'compact') {
    companionState.mainLockedOpen = false;
    clearAutoCompact();
    closeProviderMenus();
    return;
  }

  if (!companionState.pointerInWindow) {
    scheduleAutoCompact();
  }
}

// 主动从主进程读取当前外部窗口上下文。
export async function loadContext() {
  companionState.activeContext = await window.companion.getActiveContext();
}

// 打开展开态主面板，并重置悬浮球点击/菜单状态。
export async function openMainPanel(event?: Event) {
  event?.preventDefault?.();
  event?.stopPropagation?.();

  clearTimeout(companionState.agentTapTimer);
  companionState.agentTapTimer = null;
  companionState.lastAgentTapAt = 0;
  companionState.pointerInWindow = true;
  companionState.mainLockedOpen = true;
  companionState.contextMenuOpen = false;
  clearAutoCompact();
  closeProviderMenus();

  const modeState = await window.companion.setWindowMode('expanded');
  applyWindowMode(modeState);
}

// 将主面板折叠为悬浮窗模式。
export async function collapseToCompact() {
  companionState.mainLockedOpen = false;
  const modeState = await window.companion.setWindowMode('compact');
  applyWindowMode(modeState);
}

// 在悬浮窗退出按钮附近展示退出/展开上下文菜单。
export async function showExitContextBlock(event: Event) {
  event.preventDefault();

  if (companionState.windowMode !== 'compact') {
    return;
  }

  if (!companionState.revealed) {
    await window.companion.revealCompactWindow();
    companionState.revealed = true;
  }

  companionState.contextMenuOpen = true;
}

// 点击悬浮球或退出按钮外部时隐藏退出上下文菜单。
export function hideExitContextBlock(event: Event) {
  const target = event.target as HTMLElement | null;

  if (!target?.closest?.('#compactExitButton') && !target?.closest?.('#agentIcon')) {
    companionState.contextMenuOpen = false;
  }
}

// 展开或收起悬浮工具区。
export async function toggleCompactPanel() {
  if (companionState.revealed) {
    await window.companion.hideCompactTools();
    companionState.revealed = false;
    return false;
  }

  await window.companion.revealCompactWindow();
  companionState.revealed = true;
  return true;
}

// 切换悬浮回答放大查看模式，并关闭互斥面板。
export async function toggleAnswerZoom(event?: Event) {
  event?.preventDefault?.();
  event?.stopPropagation?.();

  if (companionState.windowMode !== 'compact') {
    return;
  }

  companionState.compactHistoryPanelOpen = false;
  companionState.compactModelPanelOpen = false;
  companionState.screenshotPreviewOpen = false;

  const modeState = await window.companion.setAnswerZoom(!companionState.answerZoomed);
  applyWindowMode(modeState);
}

// 处理悬浮球点击：双击打开主窗，单击展开/收起工具区。
export function handleAgentTap() {
  const now = performance.now();
  const isDoubleTap = now - companionState.lastAgentTapAt <= AGENT_DOUBLE_TAP_MS;

  if (isDoubleTap) {
    clearTimeout(companionState.agentTapTimer);
    companionState.agentTapTimer = null;
    companionState.lastAgentTapAt = 0;
    companionState.contextMenuOpen = false;
    openMainPanel();
    return;
  }

  companionState.lastAgentTapAt = now;
  clearTimeout(companionState.agentTapTimer);

  if (!companionState.revealed) {
    toggleCompactPanel();
    companionState.agentTapTimer = setTimeout(() => {
      companionState.agentTapTimer = null;
      companionState.lastAgentTapAt = 0;
    }, AGENT_DOUBLE_TAP_MS);
    return;
  }

  companionState.agentTapTimer = setTimeout(() => {
    companionState.agentTapTimer = null;
    companionState.lastAgentTapAt = 0;
    toggleCompactPanel();
  }, AGENT_TAP_DELAY_MS);
}

// 合并拖拽 move 事件到 requestAnimationFrame，降低 IPC 调用频率。
export function scheduleCompactDrag(point: { screenX: number; screenY: number }) {
  companionState.compactDragPoint = point;

  if (companionState.compactDragFrame) {
    return;
  }

  companionState.compactDragFrame = requestAnimationFrame(() => {
    companionState.compactDragFrame = null;
    const nextPoint = companionState.compactDragPoint;
    companionState.compactDragPoint = null;

    if (nextPoint) {
      window.companion.dragCompactWindow({screenX: nextPoint.screenX, screenY: nextPoint.screenY});
    }
  });
}

// 立即发送最后一次拖拽坐标，确保 pointerup 前窗口位置同步。
export function flushCompactDrag() {
  if (companionState.compactDragFrame) {
    cancelAnimationFrame(companionState.compactDragFrame);
    companionState.compactDragFrame = null;
  }

  const nextPoint = companionState.compactDragPoint;
  companionState.compactDragPoint = null;

  if (nextPoint) {
    window.companion.dragCompactWindow({screenX: nextPoint.screenX, screenY: nextPoint.screenY});
  }
}

// 释放悬浮球指针捕获；外部截图等系统级打断可能让 pointerup 丢失，所以这里统一兜底。
function releaseCompactPointerCapture(pointerId: number | null | undefined, fallbackTarget?: EventTarget | null) {
  if (typeof pointerId !== 'number') {
    return;
  }

  const fallbackElement = fallbackTarget instanceof HTMLElement ? fallbackTarget : null;
  const agentElement = document.getElementById('agentIcon');

  for (const target of [fallbackElement, agentElement]) {
    try {
      if (target?.hasPointerCapture?.(pointerId)) {
        target.releasePointerCapture(pointerId);
      }
    } catch {
      // 指针已经被系统取消或转移时，释放捕获可能抛错；状态清理仍然继续。
    }
  }
}

// 取消当前悬浮球拖拽，并在已经开始拖拽窗口时通知主进程完成吸边结算。
export function cancelCompactDrag(fallbackTarget?: EventTarget | null) {
  const pointerId = companionState.compactDrag?.pointerId;
  const wasDragging = Boolean(companionState.compactDrag?.started);

  companionState.compactDrag = null;
  releaseCompactPointerCapture(pointerId, fallbackTarget);
  flushCompactDrag();

  if (wasDragging) {
    window.companion.endCompactDrag();
  }
}

// 记录悬浮球按下位置，超过阈值后才真正进入拖拽。
export function handleAgentPointerDown(event: PointerEvent) {
  if (companionState.windowMode !== 'compact' || event.button !== 0) {
    return;
  }

  companionState.compactDrag = {
    pointerId: event.pointerId,
    startX: event.screenX,
    startY: event.screenY,
    distance: 0,
    started: false
  };
  //console.log("按下",companionState.compactDrag);
  (event.currentTarget as HTMLElement | null)?.setPointerCapture?.(event.pointerId);
  event.preventDefault();
}

// 处理悬浮球拖拽移动，首次超过阈值时通知主进程开始拖拽。
export async function handleAgentPointerMove(event: PointerEvent) {
  if (!companionState.compactDrag) {
    return;
  }

  // 如果系统截图或外部窗口吞掉 pointerup，下一次移动时 buttons 会归零，必须立即清理旧拖拽。
  if ((event.buttons & 1) !== 1) {
    cancelCompactDrag(event.currentTarget);
    return;
  }

  const dx = event.screenX - companionState.compactDrag.startX;
  const dy = event.screenY - companionState.compactDrag.startY;
  companionState.compactDrag.distance = Math.abs(dx) + Math.abs(dy);

  if (companionState.compactDrag.distance <= 6) {
    return;
  }

  if (!companionState.compactDrag.started) {
    companionState.compactDrag.started = true;
    await window.companion.beginCompactDrag({
      screenX: companionState.compactDrag.startX,
      screenY: companionState.compactDrag.startY
    });

    if (!companionState.compactDrag) {
      return;
    }
  }
  //console.log("拖动",event.screenX,event.screenY);
  scheduleCompactDrag({ screenX: event.screenX, screenY: event.screenY });
}

// 结束悬浮球拖拽；如果未超过拖拽阈值则按点击处理。
export async function handleAgentPointerUp(event: PointerEvent) {
  if (!companionState.compactDrag) {
    return;
  }

  const pointerId = companionState.compactDrag.pointerId;
  const distance = companionState.compactDrag.distance;
  const wasDragging = companionState.compactDrag.started;
  companionState.compactDrag = null;

  releaseCompactPointerCapture(pointerId, event.currentTarget);

  if (!wasDragging || distance <= 6) {
    handleAgentTap();
    return;
  }

  flushCompactDrag();
  await window.companion.endCompactDrag();
  event.preventDefault();
}

// 指针取消时清理拖拽状态，并让主进程完成吸边结算。
export function handleAgentPointerCancel(event?: PointerEvent) {
  cancelCompactDrag(event?.currentTarget);
}
