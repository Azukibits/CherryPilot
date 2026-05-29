import { LAST_PROVIDER_INDEX } from '@/renderer/entity';
import { companionState } from '@/renderer/composables/companionState';
import { textFor } from '@/renderer/composables/companionText';

// 从响应式 provider 状态中提取可保存的接口配置。
export function getProviderValues() {
  return companionState.providers.map((provider) => ({
    id: provider.id,
    label: provider.label,
    apiKey: provider.apiKey,
    baseUrl: provider.baseUrl,
    model: provider.model
  }));
}

// 读取电脑权限设置，并用工作区路径决定权限是否真正开启。
export function getComputerAccessValues() {
  const workspaceRoot = (companionState.computerAccess.workspaceRoot || '').trim();

  return {
    enabled: Boolean(workspaceRoot),
    workspaceRoot,
    allowCommands: Boolean(workspaceRoot && companionState.computerAccess.allowCommands)
  };
}

// 读取性能设置，保持低 CPU 模式默认开启。
export function getPerformanceValues() {
  return {
    lowCpuMode: companionState.lowCpuMode !== false
  };
}

// 读取 LAN 分享设置，端口和 token 由主进程持久化。
export function getLanShareValues() {
  return {
    enabled: Boolean(companionState.lanShare?.enabled),
    port: Number(companionState.lanShare?.port || 0) || 0,
    token: companionState.lanShare?.token || ''
  };
}

// 把 Vue 状态序列化成 preload bridge 需要的设置保存结构。
export function buildSettingsPayload() {
  return {
    theme: companionState.theme,
    activeProviderIndex: companionState.activeProviderIndex,
    providers: getProviderValues(),
    computerAccess: getComputerAccessValues(),
    performance: getPerformanceValues(),
    lanShare: getLanShareValues()
  };
}

// 将主进程读取到的 provider 设置回填到设置面板状态。
export function applyProviderValues(settings: CompanionSettings = {}) {
  const providers = Array.isArray(settings.providers) ? settings.providers : [];
  companionState.activeProviderIndex = Math.min(
    LAST_PROVIDER_INDEX,
    Math.max(0, Number(settings.activeProviderIndex || 0))
  );

  companionState.providers.forEach((slot, index) => {
    const provider = providers[index] || {};
    slot.apiKey = provider.apiKey || (index === 0 ? settings.apiKey || '' : '');
    slot.baseUrl = provider.baseUrl || (index === 0 ? settings.baseUrl : '') || slot.defaultBaseUrl;
    slot.model = provider.model || (index === 0 ? settings.model : '') || slot.defaultModel;
  });
}

// 将主进程读取到的电脑权限设置回填到响应式状态。
export function applyComputerAccessValues(settings: CompanionSettings = {}) {
  const access = settings.computerAccess || {};
  const enabled = Boolean(access.enabled && access.workspaceRoot);

  companionState.computerAccess.enabled = enabled;
  companionState.computerAccess.workspaceRoot = enabled ? access.workspaceRoot : '';
  companionState.computerAccess.allowCommands = Boolean(access.allowCommands && enabled);
}

// 将主进程读取到的性能设置回填到响应式状态。
export function applyPerformanceValues(settings: CompanionSettings = {}) {
  const performance = settings.performance || {};
  companionState.lowCpuMode = performance.lowCpuMode !== false;
}

// 应用主题值，只允许 light/dark 两种状态。
export function applyTheme(theme: string) {
  companionState.theme = theme === 'light' ? 'light' : 'dark';
}

// 同步系统开机自启动状态到设置面板。
export function applyStartupSettings(settings: { openAtLogin?: boolean } = {}) {
  companionState.startupOpenAtLogin = Boolean(settings.openAtLogin);
}

// 同步 LAN 分享状态，包含当前可访问 URL 列表。
export function applyLanShareStatus(status: CompanionLanShareStatus = {}) {
  companionState.lanShare.enabled = Boolean(status.enabled);
  companionState.lanShare.port = Number(status.port || 0) || 0;
  companionState.lanShare.token = status.token || '';
  companionState.lanShare.urls = Array.isArray(status.urls) ? status.urls : [];
}

// 生成 provider 在界面上的展示名称，本地模型使用独立文案。
export function providerDisplayName(slotIndex: number) {
  const slot = companionState.providers[slotIndex];
  if (slot?.local) {
    return textFor(companionState.guideLanguage, 'localModel');
  }

  return `${String(slotIndex + 1).padStart(2, '0')} ${textFor(companionState.guideLanguage, 'provider')}`;
}
