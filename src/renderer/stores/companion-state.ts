import {
  createCompanionAnswerState,
  type CompanionAnswerState
} from '@/renderer/stores/companion-answer';
import {
  createCompanionContextState,
  type CompanionContextState
} from '@/renderer/stores/companion-context';
import {
  createCompanionHistoryState,
  type CompanionHistoryState
} from '@/renderer/stores/companion-history';
import {
  createCompanionLanShareState,
  type CompanionLanShareState
} from '@/renderer/stores/companion-lan-share';
import {
  createCompanionProvidersState,
  type CompanionProvidersState
} from '@/renderer/stores/companion-providers';
import {
  createCompanionSettingsState,
  type CompanionSettingsState
} from '@/renderer/stores/companion-settings';
import {
  createCompanionVoiceState,
  type CompanionVoiceState
} from '@/renderer/stores/companion-voice';
import {
  createCompanionWindowState,
  type CompanionWindowState
} from '@/renderer/stores/companion-window';

/**
 * Companion renderer 的完整共享状态。
 * 每个业务片段在独立文件中维护，新增业务时优先新增片段而不是扩大本文件。
 */
export type CompanionStoreState = CompanionAnswerState
  & CompanionContextState
  & CompanionHistoryState
  & CompanionLanShareState
  & CompanionProvidersState
  & CompanionSettingsState
  & CompanionVoiceState
  & CompanionWindowState;

/**
 * 创建 companion store 的初始状态。
 * 这里仅组合业务片段，不写 DOM dataset，也不触发 IPC 调用。
 */
export function createCompanionState(): CompanionStoreState {
  return {
    ...createCompanionContextState(),
    ...createCompanionProvidersState(),
    ...createCompanionHistoryState(),
    ...createCompanionSettingsState(),
    ...createCompanionLanShareState(),
    ...createCompanionAnswerState(),
    ...createCompanionVoiceState(),
    ...createCompanionWindowState()
  };
}
