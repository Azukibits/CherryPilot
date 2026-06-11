export interface CompanionAnswerState {
  statusText: string;
  answerContent: string;
  answerPending: boolean;
  answerImageUrl: string;
  compactPrompt: string;
  compactModelPanelOpen: boolean;
  compactModelPanelMessage: string;
  compactModelLoading: boolean;
  compactHistoryPanelOpen: boolean;
}

/**
 * 创建回答区和紧凑面板业务的默认状态。
 */
export function createCompanionAnswerState(): CompanionAnswerState {
  return {
    statusText: '',
    answerContent: '',
    answerPending: false,
    answerImageUrl: '',
    compactPrompt: '',
    compactModelPanelOpen: false,
    compactModelPanelMessage: '',
    compactModelLoading: false,
    compactHistoryPanelOpen: false
  };
}

/**
 * 关闭紧凑窗口里的互斥浮层。
 * 截图预览状态属于上下文业务，但它和模型/历史面板在 UI 上互斥，所以这里按最小字段约束处理。
 */
export function closeCompactOverlayPanelsState(
  state: CompanionAnswerState & { screenshotPreviewOpen: boolean }
) {
  state.compactHistoryPanelOpen = false;
  state.compactModelPanelOpen = false;
  state.screenshotPreviewOpen = false;
}

/**
 * 设置紧凑模型面板开关。
 */
export function setCompactModelPanelOpenState(
  state: CompanionAnswerState,
  open: boolean
) {
  state.compactModelPanelOpen = open;
}

/**
 * 设置紧凑历史面板开关。
 */
export function setCompactHistoryPanelOpenState(
  state: CompanionAnswerState,
  open: boolean
) {
  state.compactHistoryPanelOpen = open;
}
