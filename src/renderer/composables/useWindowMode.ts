import {
  AGENT_DOUBLE_TAP_MS,
  AUTO_COMPACT_AFTER_MS
} from '@/renderer/entity';
import { nextTick } from 'vue';
import { closeCompactOverlayPanelsState } from '@/renderer/stores/companion-answer';
import { setActiveContextState } from '@/renderer/stores/companion-context';
import { closeProviderMenusState } from '@/renderer/stores/companion-providers';
import { companionState } from '@/renderer/stores/companion';
import {
  applyWindowModeState,
  clearAutoCompactTimerState,
  clearCompactDragState,
  consumeCompactDragPointState,
  lockMainPanelState,
  markCompactDragStartedState,
  queueCompactDragPointState,
  rememberAgentTapState,
  resetAgentTapState,
  setAgentTapTimerState,
  setAutoCompactTimerState,
  setCompactDragFrameState,
  setCompactRevealedState,
  setRevealAnimationState,
  setContextMenuOpenState,
  setMainLockedOpenState,
  startCompactDragState,
  toggleContextMenuOpenState,
  updateCompactDragDistanceState
} from '@/renderer/stores/companion-window';

let compactRevealTransitionId = 0;

function waitFrame() {
  return new Promise<void>((resolve) => {
    const timeout = window.setTimeout(resolve, 32);

    requestAnimationFrame(() => {
      window.clearTimeout(timeout);
      resolve();
    });
  });
}

async function waitForPaint() {
  await nextTick();
  await waitFrame();
  await waitFrame();
}

function nextRevealTransitionId() {
  compactRevealTransitionId += 1;
  return compactRevealTransitionId;
}

function isCurrentRevealTransition(transitionId: number) {
  return transitionId === compactRevealTransitionId;
}

function cancelRevealTransition() {
  nextRevealTransitionId();
  setRevealAnimationState(companionState, false);
}

/**
 * 清理展开主窗口自动收起到悬浮窗的定时器。
 */
export function clearAutoCompact() {
  clearAutoCompactTimerState(companionState);
}

/**
 * 关闭 provider 下拉菜单，可传 slotIndex 只关闭指定槽位。
 */
export function closeProviderMenus(slotIndex: number | null = null) {
  closeProviderMenusState(companionState, slotIndex);
}

/**
 * 当鼠标离开且没有锁定主窗口时，延迟切回悬浮窗。
 */
export function scheduleAutoCompact() {
  clearAutoCompact();

  if (
    companionState.windowMode !== 'expanded'
    || companionState.pointerInWindow
    || companionState.mainLockedOpen
  ) {
    return;
  }

  setAutoCompactTimerState(companionState, setTimeout(async () => {
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
  }, AUTO_COMPACT_AFTER_MS));
}

/**
 * 主进程负责真实窗口边界，renderer 只镜像界面需要的模式状态。
 */
export function applyWindowMode(nextState: CompanionWindowModeState | string | null | undefined) {
  const modeState = applyWindowModeState(companionState, nextState);

  if (!modeState) {
    return;
  }

  if (companionState.windowMode === 'compact') {
    clearAutoCompact();
    closeProviderMenus();
    return;
  }

  if (!companionState.pointerInWindow) {
    scheduleAutoCompact();
  }
}

/**
 * 主动从主进程读取当前外部窗口上下文。
 */
export async function loadContext() {
  setActiveContextState(companionState, await window.companion.getActiveContext());
}

/**
 * 打开展开态主面板，并重置悬浮球点击、菜单状态。
 */
export async function openMainPanel(event?: Event) {
  event?.preventDefault?.();
  event?.stopPropagation?.();

  cancelRevealTransition();
  lockMainPanelState(companionState);
  clearAutoCompact();
  closeProviderMenus();

  const modeState = await window.companion.setWindowMode('expanded');
  applyWindowMode(modeState);
}

/**
 * 将主面板折叠为悬浮窗模式。
 */
export async function collapseToCompact() {
  cancelRevealTransition();
  setMainLockedOpenState(companionState, false);
  const modeState = await window.companion.setWindowMode('compact');
  applyWindowMode(modeState);
}

/**
 * 原生窗口 resize 前后各等一次绘制，避免旧图标布局在新窗口尺寸里露出一帧。
 */
export async function revealCompactTools() {
  const transitionId = nextRevealTransitionId();

  setRevealAnimationState(companionState, true);

  try {
    await waitForPaint();

    if (!isCurrentRevealTransition(transitionId)) {
      return false;
    }

    const bounds = await window.companion.revealCompactWindow();

    if (!bounds || !isCurrentRevealTransition(transitionId)) {
      return false;
    }

    setCompactRevealedState(companionState, true);
    await waitForPaint();
    return true;
  } finally {
    if (isCurrentRevealTransition(transitionId)) {
      setRevealAnimationState(companionState, false);
    }
  }
}

/**
 * 收起工具区时同样隐藏过渡帧，避免坐标和窗口尺寸短暂不一致。
 */
export async function hideCompactTools() {
  const transitionId = nextRevealTransitionId();

  setRevealAnimationState(companionState, true);

  try {
    await waitForPaint();

    if (!isCurrentRevealTransition(transitionId)) {
      return false;
    }

    const bounds = await window.companion.hideCompactTools();

    if (!bounds || !isCurrentRevealTransition(transitionId)) {
      return false;
    }

    setCompactRevealedState(companionState, false);
    await waitForPaint();
    return false;
  } finally {
    if (isCurrentRevealTransition(transitionId)) {
      setRevealAnimationState(companionState, false);
    }
  }
}

/**
 * 在悬浮窗退出按钮附近展示退出/展开上下文菜单。
 */
export async function showExitContextBlock(event: Event) {
  event.preventDefault();

  if (companionState.windowMode !== 'compact') {
    return;
  }

  if (!companionState.revealed) {
    await revealCompactTools();
  }

  toggleContextMenuOpenState(companionState);
}

/**
 * 点击悬浮球或退出按钮外部时隐藏退出上下文菜单。
 */
export function hideExitContextBlock(event: Event) {
  const target = event.target as HTMLElement | null;

  if (!target?.closest?.('#compactExitButton') && !target?.closest?.('#agentIcon')) {
    setContextMenuOpenState(companionState, false);
  }
}

/**
 * 展开或收起悬浮工具区。
 */
export async function toggleCompactPanel() {
  if (companionState.revealed) {
    return hideCompactTools();
  }

  return revealCompactTools();
}

/**
 * 切换悬浮回答放大查看模式，并关闭互斥面板。
 */
export async function toggleAnswerZoom(event?: Event) {
  event?.preventDefault?.();
  event?.stopPropagation?.();

  if (companionState.windowMode !== 'compact') {
    return;
  }

  closeCompactOverlayPanelsState(companionState);

  const modeState = await window.companion.setAnswerZoom(!companionState.answerZoomed);
  applyWindowMode(modeState);
}

/**
 * 处理悬浮球点击：双击打开主窗口，单击展开/收起工具区。
 */
export function handleAgentTap() {
  const now = performance.now();
  const isDoubleTap = now - companionState.lastAgentTapAt <= AGENT_DOUBLE_TAP_MS;

  if (isDoubleTap) {
    resetAgentTapState(companionState);
    setContextMenuOpenState(companionState, false);
    openMainPanel();
    return;
  }

  rememberAgentTapState(companionState, now);
  void toggleCompactPanel();

  setAgentTapTimerState(companionState, setTimeout(() => {
    resetAgentTapState(companionState);
  }, AGENT_DOUBLE_TAP_MS));
}

/**
 * 合并拖拽 move 事件到 requestAnimationFrame，降低 IPC 调用频率。
 */
export function scheduleCompactDrag(point: { screenX: number; screenY: number }) {
  queueCompactDragPointState(companionState, point);

  if (companionState.compactDragFrame) {
    return;
  }

  setCompactDragFrameState(companionState, requestAnimationFrame(() => {
    setCompactDragFrameState(companionState, null);
    const nextPoint = consumeCompactDragPointState(companionState);

    if (nextPoint) {
      window.companion.dragCompactWindow({
        screenX: nextPoint.screenX,
        screenY: nextPoint.screenY
      });
    }
  }));
}

/**
 * 立即发送最后一次拖拽坐标，确保 pointerup 前窗口位置同步。
 */
export function flushCompactDrag() {
  if (companionState.compactDragFrame) {
    cancelAnimationFrame(companionState.compactDragFrame);
    setCompactDragFrameState(companionState, null);
  }

  const nextPoint = consumeCompactDragPointState(companionState);

  if (nextPoint) {
    window.companion.dragCompactWindow({
      screenX: nextPoint.screenX,
      screenY: nextPoint.screenY
    });
  }
}

/**
 * 释放悬浮球指针捕获；外部截图等系统级打断可能让 pointerup 丢失。
 */
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

/**
 * 取消当前悬浮球拖拽，并在已经开始拖拽窗口时通知主进程完成吸边结算。
 */
export function cancelCompactDrag(fallbackTarget?: EventTarget | null) {
  const drag = clearCompactDragState(companionState);
  const pointerId = drag?.pointerId;
  const wasDragging = Boolean(drag?.started);

  releaseCompactPointerCapture(pointerId, fallbackTarget);
  flushCompactDrag();

  if (wasDragging) {
    window.companion.endCompactDrag();
  }
}

/**
 * 记录悬浮球按下位置，超过阈值后才真正进入拖拽。
 */
export function handleAgentPointerDown(event: PointerEvent) {
  if (companionState.windowMode !== 'compact' || event.button !== 0) {
    return;
  }

  startCompactDragState(companionState, {
    pointerId: event.pointerId,
    screenX: event.screenX,
    screenY: event.screenY
  });

  (event.currentTarget as HTMLElement | null)?.setPointerCapture?.(event.pointerId);
  event.preventDefault();
}

/**
 * 处理悬浮球拖拽移动，首次超过阈值时通知主进程开始拖拽。
 */
export async function handleAgentPointerMove(event: PointerEvent) {
  if (!companionState.compactDrag) {
    return;
  }

  if ((event.buttons & 1) !== 1) {
    cancelCompactDrag(event.currentTarget);
    return;
  }

  const distance = updateCompactDragDistanceState(companionState, {
    screenX: event.screenX,
    screenY: event.screenY
  });

  if (distance === null || distance <= 6) {
    return;
  }

  const drag = companionState.compactDrag;

  if (!drag.started) {
    markCompactDragStartedState(companionState);
    await window.companion.beginCompactDrag({
      screenX: drag.startX,
      screenY: drag.startY
    });

    if (!companionState.compactDrag) {
      return;
    }
  }

  scheduleCompactDrag({ screenX: event.screenX, screenY: event.screenY });
}

/**
 * 结束悬浮球拖拽；未超过拖拽阈值时按普通点击处理。
 */
export async function handleAgentPointerUp(event: PointerEvent) {
  const drag = clearCompactDragState(companionState);

  if (!drag) {
    return;
  }

  releaseCompactPointerCapture(drag.pointerId, event.currentTarget);

  if (!drag.started || drag.distance <= 6) {
    handleAgentTap();
    return;
  }

  flushCompactDrag();
  await window.companion.endCompactDrag();
  event.preventDefault();
}

/**
 * 指针取消时清理拖拽状态，并让主进程完成吸边结算。
 */
export function handleAgentPointerCancel(event?: PointerEvent) {
  cancelCompactDrag(event?.currentTarget);
}
