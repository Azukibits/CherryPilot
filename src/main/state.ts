// 主线程运行态集中维护
// 跨窗口、截图、LAN 和上下文轮询共享的可变状态都放在这里，业务模块只读写 mainState。
import type { BrowserWindow, Display, Rectangle } from 'electron';
import type { Server } from 'node:http';

export interface ActiveWindowContext {
  title: string;
  checkedAt: string | null;
}

export interface LanShareState {
  enabled: boolean;
  port: number;
  token: string;
}

export interface RegionCaptureState {
  display: Display;
  bounds: Rectangle;
}

export type CompactDockSide = 'left' | 'right' | 'top' | 'bottom';

export interface CompactAnswerRestoreState {
  bounds: Rectangle;
  dockSide: CompactDockSide;
  revealed: boolean;
  docked: boolean;
}

export interface CompactDragState {
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
  bounds: Rectangle;
}

export interface MainState {
  // 主窗口实例，窗口、权限、IPC 回调都通过它发送事件。
  mainWindow: BrowserWindow | null;
  // 截图选择覆盖层窗口实例。
  captureWindow: BrowserWindow | null;
  // 外部窗口标题轮询定时器。
  contextTimer: NodeJS.Timeout | null;
  // 当前轮询间隔，用于低 CPU 模式切换时避免重复创建定时器。
  currentContextPollInterval: number;
  // 悬浮窗失焦后延迟收起工具区的定时器。
  compactExternalBlurTimer: NodeJS.Timeout | null;
  // 悬浮窗临时取消置顶后恢复置顶的定时器。
  compactTopmostRestoreTimer: NodeJS.Timeout | null;
  // LAN ?? HTTP ?????
  lanShareServer: Server | null;
  // LAN 分享对外状态。
  lanShareState: LanShareState | null;
  // 正在执行的窗口标题刷新 Promise，防止并发轮询。
  contextRefreshInFlight: Promise<ActiveWindowContext> | null;
  // 最近一次刷新窗口标题的时间戳。
  lastContextRefreshAt: number;
  // 当前窗口模式。
  windowMode: 'expanded' | 'compact';
  // 悬浮窗拖拽过程中的起始坐标和窗口边界。
  compactDragState: CompactDragState | null;
  // 悬浮窗当前贴靠的屏幕边。
  compactDockSide: CompactDockSide;
  // 悬浮窗工具区是否展开。
  compactRevealed: boolean;
  // 悬浮窗是否吸附到屏幕边缘。
  compactDocked: boolean;
  // 悬浮回答是否进入放大查看模式。
  compactAnswerZoomed: boolean;
  // 悬浮回答放大前的窗口状态，用于恢复。
  compactAnswerRestoreState: CompactAnswerRestoreState | null;
  // 当前正在进行的截图选择上下文。
  currentCapture: RegionCaptureState | null;
  // 最近一次捕获到的外部窗口标题。
  lastExternalContext: ActiveWindowContext;
}

export const mainState: MainState = {
  mainWindow: null,
  captureWindow: null,
  contextTimer: null,
  currentContextPollInterval: 0,
  compactExternalBlurTimer: null,
  compactTopmostRestoreTimer: null,
  lanShareServer: null,
  lanShareState: null,
  contextRefreshInFlight: null,
  lastContextRefreshAt: 0,
  windowMode: 'expanded',
  compactDragState: null,
  compactDockSide: 'right',
  compactRevealed: false,
  compactDocked: false,
  compactAnswerZoomed: false,
  compactAnswerRestoreState: null,
  currentCapture: null,
  lastExternalContext: {
    title: '等待外部窗口',
    checkedAt: null
  }
};
