/**
 * 悬浮窗拖拽过程中的临时指针状态。
 * 这些字段只用于判断拖拽阈值和把屏幕坐标传给主进程。
 */
export interface CompactDragState {
  pointerId: number;
  startX: number;
  startY: number;
  distance: number;
  started: boolean;
}

export interface CompanionWindowState {
  windowMode: string;
  dockSide: string;
  revealed: boolean;
  revealAnimation: boolean;
  docked: boolean;
  answerZoomed: boolean;
  contextMenuOpen: boolean;
  isBusy: boolean;
  pointerInWindow: boolean;
  compactDrag: CompactDragState | null;
  compactDragFrame: number | null;
  compactDragPoint: CompanionPoint | null;
  agentTapTimer: ReturnType<typeof setTimeout> | null;
  lastAgentTapAt: number;
  dragDepth: number;
  dragging: boolean;
  autoCompactTimer: ReturnType<typeof setTimeout> | null;
  mainLockedOpen: boolean;
}

export type CompanionWindowModeInput = CompanionWindowModeState | string | null | undefined;

export interface CompactDragStartPoint {
  pointerId: number;
  screenX: number;
  screenY: number;
}

export interface CompactDragScreenPoint {
  screenX: number;
  screenY: number;
}

/**
 * 创建窗口模式和悬浮交互业务的默认状态。
 */
export function createCompanionWindowState(): CompanionWindowState {
  return {
    windowMode: 'expanded',
    dockSide: 'right',
    revealed: false,
    revealAnimation: false,
    docked: false,
    answerZoomed: false,
    contextMenuOpen: false,
    isBusy: false,
    pointerInWindow: false,
    compactDrag: null,
    compactDragFrame: null,
    compactDragPoint: null,
    agentTapTimer: null,
    lastAgentTapAt: 0,
    dragDepth: 0,
    dragging: false,
    autoCompactTimer: null,
    mainLockedOpen: true
  };
}

/**
 * 清理展开主窗口自动收起定时器。
 */
export function clearAutoCompactTimerState(state: CompanionWindowState) {
  clearTimeout(state.autoCompactTimer);
  state.autoCompactTimer = null;
}

/**
 * 记录新的自动收起定时器句柄，便于后续统一清理。
 */
export function setAutoCompactTimerState(
  state: CompanionWindowState,
  timer: ReturnType<typeof setTimeout>
) {
  state.autoCompactTimer = timer;
}

/**
 * 应用主进程返回的窗口模式镜像。
 * 主进程负责真实窗口边界，renderer 只保存 UI 渲染需要的状态。
 */
export function applyWindowModeState(
  state: CompanionWindowState,
  nextState: CompanionWindowModeInput
) {
  if (!nextState) {
    return null;
  }

  const modeState: CompanionWindowModeState = typeof nextState === 'string'
    ? { mode: nextState }
    : nextState;

  state.windowMode = modeState.mode || 'expanded';
  state.answerZoomed = Boolean(modeState.answerZoomed);
  state.dockSide = modeState.dockSide || 'right';
  state.revealed = Boolean(modeState.revealed);
  state.docked = Boolean(modeState.docked);

  if (state.windowMode === 'compact') {
    state.mainLockedOpen = false;
  }
  return modeState;
}

/**
 * 重置悬浮球点击计时，用于区分单击展开和双击打开主面板。
 */
export function resetAgentTapState(state: CompanionWindowState) {
  clearTimeout(state.agentTapTimer);
  state.agentTapTimer = null;
  state.lastAgentTapAt = 0;
}

/**
 * 记录一次悬浮球点击时间，并清理旧的点击确认定时器。
 */
export function rememberAgentTapState(state: CompanionWindowState, tappedAt: number) {
  clearTimeout(state.agentTapTimer);
  state.agentTapTimer = null;
  state.lastAgentTapAt = tappedAt;
}

/**
 * 保存单击确认定时器，双击发生时可以取消。
 */
export function setAgentTapTimerState(
  state: CompanionWindowState,
  timer: ReturnType<typeof setTimeout>
) {
  state.agentTapTimer = timer;
}

/**
 * 标记主面板被用户主动打开，自动收起逻辑会尊重这个锁定状态。
 */
export function lockMainPanelState(state: CompanionWindowState) {
  resetAgentTapState(state);
  state.pointerInWindow = true;
  state.mainLockedOpen = true;
  state.contextMenuOpen = false;
}

/**
 * 设置主面板锁定状态。
 */
export function setMainLockedOpenState(state: CompanionWindowState, locked: boolean) {
  state.mainLockedOpen = locked;
}

/**
 * 更新鼠标是否位于窗口内。
 */
export function setPointerInWindowState(state: CompanionWindowState, inside: boolean) {
  state.pointerInWindow = inside;
}

/**
 * 更新紧凑窗口工具区展开状态。
 */
export function setCompactRevealedState(state: CompanionWindowState, revealed: boolean) {
  state.revealed = revealed;
}

/**
 * 控制悬浮球在窗口尺寸切换期间临时隐藏。
 * 这个状态只保护原生窗口 resize 和 renderer 重排之间的过渡帧。
 */
export function setRevealAnimationState(state: CompanionWindowState, active: boolean) {
  state.revealAnimation = active;
}

/**
 * 设置退出上下文菜单开关。
 */
export function setContextMenuOpenState(state: CompanionWindowState, open: boolean) {
  state.contextMenuOpen = open;
}

/**
 * 切换退出上下文菜单，并返回切换后的状态。
 */
export function toggleContextMenuOpenState(state: CompanionWindowState) {
  state.contextMenuOpen = !state.contextMenuOpen;
  return state.contextMenuOpen;
}

/**
 * 记录下一帧需要发送给主进程的拖拽坐标。
 */
export function queueCompactDragPointState(
  state: CompanionWindowState,
  point: CompactDragScreenPoint
) {
  state.compactDragPoint = point;
}

/**
 * 取出待发送拖拽坐标，并立即清空队列。
 */
export function consumeCompactDragPointState(state: CompanionWindowState) {
  const point = state.compactDragPoint;
  state.compactDragPoint = null;
  return point;
}

/**
 * 设置拖拽 requestAnimationFrame 句柄。
 */
export function setCompactDragFrameState(
  state: CompanionWindowState,
  frame: number | null
) {
  state.compactDragFrame = frame;
}

/**
 * 开始记录悬浮球拖拽候选状态。
 */
export function startCompactDragState(
  state: CompanionWindowState,
  point: CompactDragStartPoint
) {
  state.compactDrag = {
    pointerId: point.pointerId,
    startX: point.screenX,
    startY: point.screenY,
    distance: 0,
    started: false
  };
}

/**
 * 清空当前拖拽状态，并返回被清理的状态快照。
 */
export function clearCompactDragState(state: CompanionWindowState) {
  const drag = state.compactDrag;
  state.compactDrag = null;
  return drag;
}

/**
 * 根据最新指针坐标更新拖拽距离。
 */
export function updateCompactDragDistanceState(
  state: CompanionWindowState,
  point: CompactDragScreenPoint
) {
  if (!state.compactDrag) {
    return null;
  }

  const dx = point.screenX - state.compactDrag.startX;
  const dy = point.screenY - state.compactDrag.startY;
  state.compactDrag.distance = Math.abs(dx) + Math.abs(dy);
  return state.compactDrag.distance;
}

/**
 * 标记拖拽已经超过阈值并正式开始。
 */
export function markCompactDragStartedState(state: CompanionWindowState) {
  if (state.compactDrag) {
    state.compactDrag.started = true;
  }
}

/**
 * 文件拖拽进入窗口时递增层级，并展示拖拽态。
 */
export function enterWindowFileDragState(state: CompanionWindowState) {
  state.dragDepth += 1;
  state.dragging = true;
}

/**
 * 文件拖拽离开窗口时递减层级，全部离开后关闭拖拽态。
 */
export function leaveWindowFileDragState(state: CompanionWindowState) {
  state.dragDepth = Math.max(0, state.dragDepth - 1);

  if (state.dragDepth === 0) {
    state.dragging = false;
  }
}

/**
 * 文件释放或流程中断后重置窗口拖拽态。
 */
export function resetWindowFileDragState(state: CompanionWindowState) {
  state.dragDepth = 0;
  state.dragging = false;
}
