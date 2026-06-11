import {
  GUIDE_LANGUAGE_KEY,
  type GuideLanguage
} from '@/renderer/entity';
import { normalizeGuideLanguage } from '@/renderer/composables/companionText';

export interface CompanionSettingsState {
  theme: 'dark' | 'light';
  guideLanguage: GuideLanguage;
  lowCpuMode: boolean;
  computerAccess: {
    enabled: boolean;
    workspaceRoot: string;
    allowCommands: boolean;
  };
  startupOpenAtLogin: boolean;
}

/**
 * 读取用户上次选择的说明语言。
 * localStorage 可能在受限环境抛错，所以初始化阶段必须提供安全默认值。
 */
export function initialGuideLanguage(): GuideLanguage {
  try {
    return normalizeGuideLanguage(localStorage.getItem(GUIDE_LANGUAGE_KEY));
  } catch {
    return 'zh';
  }
}

/**
 * 创建设置业务的默认状态。
 * 持久化读写由 settingsPayload 和设置面板流程负责。
 */
export function createCompanionSettingsState(): CompanionSettingsState {
  return {
    theme: 'dark',
    guideLanguage: initialGuideLanguage(),
    lowCpuMode: true,
    computerAccess: {
      enabled: false,
      workspaceRoot: '',
      allowCommands: false
    },
    startupOpenAtLogin: false
  };
}
