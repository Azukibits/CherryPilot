/**
 * 历史问答面板展示的数据结构。
 * 这里只保存 UI 需要回放的摘要，不承载完整请求上下文。
 */
export interface HistoryEntry {
  id: string;
  askedAt: string;
  question?: string;
  answer?: string;
  model?: string;
  hasImage?: boolean;
  imageUrl?: string;
  attachmentCount?: number;
}

export interface CompanionHistoryState {
  history: HistoryEntry[];
}

/**
 * 创建历史记录业务的默认状态。
 */
export function createCompanionHistoryState(): CompanionHistoryState {
  return {
    history: []
  };
}
