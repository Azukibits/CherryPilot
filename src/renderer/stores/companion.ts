/**
 * Companion store 公共入口。
 * 具体业务拆在同目录文件中，调用侧继续使用原来的 '@/renderer/stores/companion' 路径。
 */
export type {
  AttachmentItem,
  CompanionContextState
} from '@/renderer/stores/companion-context';
export type {
  CompanionProvidersState,
  ProviderState
} from '@/renderer/stores/companion-providers';
export type {
  CompanionHistoryState,
  HistoryEntry
} from '@/renderer/stores/companion-history';
export type { CompanionSettingsState } from '@/renderer/stores/companion-settings';
export type { CompanionLanShareState } from '@/renderer/stores/companion-lan-share';
export type { CompanionAnswerState } from '@/renderer/stores/companion-answer';
export type { CompanionVoiceState } from '@/renderer/stores/companion-voice';
export type {
  CompactDragState,
  CompanionWindowState
} from '@/renderer/stores/companion-window';
export type { CompanionStoreState } from '@/renderer/stores/companion-state';
export { companionState, useCompanionStore } from '@/renderer/stores/companion-store';
export { setBusy, setCompactAnswer, setStatusText } from '@/renderer/stores/companion-actions';
