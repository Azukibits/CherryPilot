import { companionState, setCompactAnswer, setStatusText, type ProviderState } from '@/renderer/composables/companionState';
import { errorMessage } from '@/renderer/composables/errorMessage';
import { formatText, textFor } from '@/renderer/composables/companionText';
import { buildSettingsPayload, providerDisplayName } from '@/renderer/composables/settingsPayload';

// 当前语言的普通文案读取器。
const t = (key: Parameters<typeof textFor>[1]) => textFor(companionState.guideLanguage, key);
// 当前语言的带参数文案格式化工具。
const ft = (key: Parameters<typeof formatText>[1], values: Record<string, unknown> = {}) => (
  formatText(companionState.guideLanguage, key, values)
);

// 悬浮模型面板中的单个可选模型项。
export interface CompactModelOption {
  slotIndex: number;
  model: string;
  providerName: string;
}

// 判断 provider 是否具备拉取/使用模型所需的最小配置。
function isProviderConfigured(provider: ProviderState) {
  return provider.baseUrl.trim() && (provider.local || provider.apiKey.trim());
}

// 关闭悬浮模型选择面板并清空提示。
export function closeCompactModelPanel() {
  companionState.compactModelPanelOpen = false;
  companionState.compactModelPanelMessage = '';
}

// 合并各 provider 当前模型和已拉取模型列表，生成面板选项。
export function getCombinedModelOptions(): CompactModelOption[] {
  const options: CompactModelOption[] = [];

  companionState.providers.forEach((provider, slotIndex) => {
    if (!isProviderConfigured(provider)) {
      return;
    }

    const models = [...new Set([
      provider.model.trim(),
      ...(companionState.modelLists[slotIndex] || [])
    ].filter(Boolean))];

    for (const model of models) {
      options.push({
        slotIndex,
        model,
        providerName: providerDisplayName(slotIndex)
      });
    }
  });

  return options;
}

// 静默拉取指定 provider 的模型列表，失败交给调用方汇总。
async function loadModelListQuietly(slotIndex = 0) {
  const provider = companionState.providers[slotIndex];
  const result = await window.companion.listModels({
    apiKey: provider.apiKey,
    baseUrl: provider.baseUrl
  });

  companionState.modelLists[slotIndex] = result.models || [];
  return companionState.modelLists[slotIndex];
}

// 打开悬浮模型选择面板，并并发刷新已配置 provider 的模型列表。
export async function openCompactModelPanel() {
  const configuredSlots = companionState.providers
    .map((provider, slotIndex) => ({ provider, slotIndex }))
    .filter(({ provider }) => isProviderConfigured(provider));

  companionState.compactModelPanelOpen = true;
  companionState.compactModelPanelMessage = t('compactModelFetching');

  if (configuredSlots.length === 0) {
    companionState.compactModelPanelMessage = t('compactModelNeedConfig');
    return;
  }

  companionState.compactModelLoading = true;
  const results = await Promise.allSettled(
    configuredSlots.map(({ slotIndex }) => loadModelListQuietly(slotIndex))
  );
  companionState.compactModelLoading = false;

  const failed = results.filter((result) => result.status === 'rejected').length;
  companionState.compactModelPanelMessage = failed === configuredSlots.length
    ? t('compactModelFetchFailed')
    : '';
}

// 切换模型面板显示状态，并关闭互斥的历史/截图面板。
export async function toggleCompactModelPanel() {
  if (companionState.compactModelPanelOpen) {
    closeCompactModelPanel();
    return;
  }

  companionState.compactHistoryPanelOpen = false;
  companionState.screenshotPreviewOpen = false;

  try {
    await openCompactModelPanel();
  } catch (error: unknown) {
    companionState.compactModelLoading = false;
    companionState.compactModelPanelOpen = true;
    companionState.compactModelPanelMessage = errorMessage(error, t('modelRefreshFailed'));
  }
}

// 选择模型后同步活动 provider、保存设置并更新提示文案。
export async function selectCompactModel(option: CompactModelOption) {
  const provider = companionState.providers[option.slotIndex];
  companionState.activeProviderIndex = option.slotIndex;
  provider.model = option.model;

  await window.companion.saveSettings(buildSettingsPayload());
  setStatusText(ft('providerSelectedModel', {
    provider: option.providerName,
    model: option.model
  }));
  setCompactAnswer(ft('switchedModel', {
    provider: option.providerName,
    model: option.model
  }));
  closeCompactModelPanel();
}
