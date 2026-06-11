/**
 * 上下文业务：活跃窗口、截图和附件。
 * 本文件只描述 renderer 需要保存的上下文数据，不负责截图或文件读取流程。
 */
export type AttachmentItem = CompanionAttachmentItem;

export interface CompanionContextState {
  activeContext: CompanionActiveContext;
  screenshotDataUrl: string;
  screenshotPreviewOpen: boolean;
  attachments: AttachmentItem[];
}

/**
 * 创建上下文业务的默认状态。
 */
export function createCompanionContextState(): CompanionContextState {
  return {
    activeContext: { title: '', checkedAt: null },
    screenshotDataUrl: '',
    screenshotPreviewOpen: false,
    attachments: []
  };
}

/**
 * 更新当前活跃窗口上下文。
 * 主进程返回空值时保留一个安全的空上下文，避免调用侧自行兜底。
 */
export function setActiveContextState(
  state: CompanionContextState,
  context: CompanionActiveContext | null | undefined
) {
  state.activeContext = context || { title: '', checkedAt: null };
}

/**
 * 设置截图预览面板开关。
 */
export function setScreenshotPreviewOpenState(
  state: CompanionContextState,
  open: boolean
) {
  state.screenshotPreviewOpen = open;
}
