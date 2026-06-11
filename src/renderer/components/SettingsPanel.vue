<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import ProviderCard from '@/renderer/components/ProviderCard.vue';
import { companionState, setBusy, setStatusText } from '@/renderer/stores/companion';
import { errorMessage } from '@/renderer/composables/errorMessage';
import { formatText, GUIDE_CONTENT, GUIDE_LANGUAGE_KEY, normalizeGuideLanguage, textFor, type GuideLanguage } from '@/renderer/composables/companionText';
import {
  applyComputerAccessValues,
  applyLanShareStatus,
  applyPerformanceValues,
  applyProviderValues,
  applyStartupSettings,
  applyTheme,
  buildSettingsPayload,
  providerDisplayName
} from '@/renderer/composables/settingsPayload';

// 设置面板直接读写共享状态，保存时再序列化给主进程。
const state = companionState;
// 保存按钮的局部 loading 状态。
const saveBusy = ref(false);
// 开机自启切换的局部 loading 状态。
const startupBusy = ref(false);
// 局域网共享切换的局部 loading 状态。
const lanBusy = ref(false);
const lanSendingDeviceId = ref('');
// 更新状态监听的清理函数，组件卸载时取消订阅。
let removeUpdateListener: (() => void) | undefined;
let removeLanDevicesListener: (() => void) | undefined;

// 当前语言文本读取器。
const t = (key: Parameters<typeof textFor>[1]) => textFor(state.guideLanguage, key);
// 当前语言格式化文本读取器。
const ft = (key: Parameters<typeof formatText>[1], values: Record<string, unknown> = {}) => (
  formatText(state.guideLanguage, key, values)
);

// ProviderCard 需要的所有标签集中计算，避免子组件直接依赖文案模块。
const providerLabels = computed(() => ({
  apiKey: t('apiKey'),
  baseUrl: t('baseUrl'),
  model: t('model'),
  chooseModel: t('chooseModel'),
  refreshModel: t('refreshModel'),
  localModel: t('localModel'),
  localKeyPlaceholder: t('localKeyPlaceholder'),
  provider: t('provider'),
  providerMeta: t('providerMeta'),
  modelEmpty: t('modelEmpty')
}));

// 当前语言的使用说明条目。
const guideItems = computed(() => GUIDE_CONTENT[state.guideLanguage]);
// 设置区状态文案，未设置时显示等待 Key。
const statusText = computed(() => state.statusText || t('waitingKey'));
// 局域网共享地址，未开启或无地址时显示对应占位文案。
const lanDevices = computed(() => state.lanShare.devices || []);

const lanShareSummary = computed(() => {
  if (!state.lanShare.enabled) {
    return t('lanUrlIdle');
  }

  return lanDevices.value.length > 0
    ? ft('lanDeviceCount', { count: lanDevices.value.length })
    : t('lanDevicesEmpty');
});

const lanDiagnosticText = computed(() => {
  if (!state.lanShare.enabled) {
    return '';
  }

  const diagnostics = state.lanShare.diagnostics || {};
  const addresses = Array.isArray(diagnostics.addresses) ? diagnostics.addresses : [];
  const port = diagnostics.port || state.lanShare.port || '-';
  const discoveryPort = diagnostics.discoveryPort || 49328;
  const deviceName = diagnostics.deviceName || state.lanShare.deviceName || 'CherryPilot';

  if (addresses.length === 0) {
    return state.guideLanguage === 'en'
      ? `Local device: ${deviceName}. Waiting for a LAN address. Discovery UDP ${discoveryPort}.`
      : `本机设备：${deviceName}。等待局域网地址，发现端口 UDP ${discoveryPort}。`;
  }

  return state.guideLanguage === 'en'
    ? `Local device: ${deviceName}. Receiver ${addresses.map((address) => `${address}:${port}`).join(', ')}. Discovery UDP ${discoveryPort}.`
    : `本机设备：${deviceName}。接收 ${addresses.map((address) => `${address}:${port}`).join('，')}。发现 UDP ${discoveryPort}。`;
});

const lanSecurityText = computed(() => (
  state.guideLanguage === 'en'
    ? 'Secure mode: discovery does not broadcast the receiver token. The sender verifies device identity, then the receiver must approve a 60-second one-time transfer ticket.'
    : '安全模式：发现广播不带接收 token；发送前会校验设备身份，接收端确认后才生成 60 秒一次性传输票据。'
));

const lanTroubleshootingText = computed(() => (
  state.guideLanguage === 'en'
    ? 'If no device appears, enable LAN sharing on both computers, keep them on the same subnet, and allow this app plus UDP 49328 through the firewall.'
    : '如果没有设备，确认两边都已开启局域网共享、处在同一网段，并允许防火墙通过本应用和 UDP 49328。'
));

// 关闭模型下拉菜单；传入索引时只关闭指定接口。
function closeModelMenu(slotIndex: number | null = null) {
  state.providers.forEach((provider, index) => {
    if (slotIndex === null || index === slotIndex) {
      provider.menuOpen = false;
    }
  });
}

// 打开指定接口的模型下拉菜单。
function openModelMenu(slotIndex: number) {
  closeModelMenu();
  state.providers[slotIndex].menuOpen = true;
}

// 只有已有模型列表时，输入框聚焦才自动打开菜单。
function openModelMenuIfLoaded(slotIndex: number) {
  if ((state.modelLists[slotIndex] || []).length > 0) {
    openModelMenu(slotIndex);
  }
}

// 点击下拉按钮时切换指定接口的模型菜单。
function toggleModelMenu(slotIndex: number) {
  if (state.providers[slotIndex].menuOpen) {
    closeModelMenu(slotIndex);
    return;
  }

  openModelMenu(slotIndex);
}

// 选择模型并标记当前活跃接口。
function selectModel(slotIndex: number, model: string) {
  state.activeProviderIndex = slotIndex;
  state.providers[slotIndex].model = model;
  setStatusText(ft('modelSelected', { provider: providerDisplayName(slotIndex) }));
  closeModelMenu(slotIndex);
}

// 接收 ProviderCard 的字段变更，集中更新共享状态，避免子组件改 prop。
function updateProviderField(
  slotIndex: number,
  field: 'apiKey' | 'baseUrl' | 'model',
  value: string
) {
  state.providers[slotIndex][field] = value;
}

// 从当前接口配置拉取可用模型列表。
async function refreshModels(slotIndex = 0) {
  const slot = state.providers[slotIndex];
  setBusy(true);
  slot.isRefreshing = true;
  setStatusText(ft('refreshingModels', { provider: providerDisplayName(slotIndex) }));

  try {
    const result = await window.companion.listModels({
      apiKey: slot.apiKey,
      baseUrl: slot.baseUrl
    });

    state.modelLists[slotIndex] = result.models || [];

    if (!slot.model && state.modelLists[slotIndex].length > 0) {
      slot.model = state.modelLists[slotIndex][0];
    }

    setStatusText(state.modelLists[slotIndex].length
      ? ft('modelsFetched', { provider: providerDisplayName(slotIndex), count: state.modelLists[slotIndex].length })
      : t('noModels'));
    openModelMenu(slotIndex);
  } catch (error: unknown) {
    setStatusText(errorMessage(error, t('modelRefreshFailed')));
  } finally {
    slot.isRefreshing = false;
    setBusy(false);
  }
}

// 保存完整设置，并用主进程返回值回填本地状态。
async function saveSettings() {
  saveBusy.value = true;
  setBusy(true);

  try {
    const settings = await window.companion.saveSettings(buildSettingsPayload());
    applyProviderValues(settings);
    setStatusText(t('saved'));
  } catch (error: unknown) {
    setStatusText(errorMessage(error, t('saveFailed')));
  } finally {
    saveBusy.value = false;
    setBusy(false);
  }
}

// 切换主题后立即持久化。
async function chooseTheme(theme: 'dark' | 'light') {
  applyTheme(theme);
  await window.companion.saveSettings(buildSettingsPayload());
}

// 选择并授权 AI 可访问的工作目录。
async function chooseWorkspaceRoot() {
  try {
    const workspaceRoot = await window.companion.selectWorkspaceRoot();

    if (!workspaceRoot) {
      return;
    }

    applyComputerAccessValues({
      computerAccess: {
        enabled: true,
        workspaceRoot,
        allowCommands: Boolean(state.computerAccess.allowCommands)
      }
    });
    await window.companion.saveSettings(buildSettingsPayload());
    setStatusText(t('workspaceAuthorizedStatus'));
  } catch (error: unknown) {
    setStatusText(errorMessage(error, t('chooseWorkspaceFailed')));
  }
}

// 清空工作目录授权，同时关闭命令权限。
async function clearWorkspaceAccess() {
  applyComputerAccessValues({ computerAccess: { enabled: false, workspaceRoot: '', allowCommands: false } });
  await window.companion.saveSettings(buildSettingsPayload());
  setStatusText(t('workspaceRevokedStatus'));
}

// 切换命令权限；没有工作目录时先引导选择目录。
async function toggleCommandAccess() {
  if (!state.computerAccess.workspaceRoot) {
    state.computerAccess.allowCommands = false;
    await chooseWorkspaceRoot();
    return;
  }

  await window.companion.saveSettings(buildSettingsPayload());
  setStatusText(state.computerAccess.allowCommands ? t('commandEnabledStatus') : t('commandDisabledStatus'));
}

// 读取持久化设置并应用到共享状态。
async function loadSettings() {
  const settings = await window.companion.getSettings();
  applyProviderValues(settings);
  applyComputerAccessValues(settings);
  applyPerformanceValues(settings);
  applyTheme(settings.theme || 'dark');
  setStatusText(state.providers[0].apiKey ? t('configured') : t('waitingKey'));
}

// 读取开机自启状态。
async function loadStartupSettings() {
  try {
    const settings = await window.companion.getStartupSettings();
    applyStartupSettings(settings);
  } catch {
    setStatusText(t('startupReadFailed'));
  }
}

// 切换开机自启，并在失败时回滚到主进程实际状态。
async function toggleStartupLaunch() {
  startupBusy.value = true;

  try {
    const settings = await window.companion.setStartupEnabled(state.startupOpenAtLogin);
    applyStartupSettings(settings);
    setStatusText(settings.openAtLogin ? t('startupEnabledStatus') : t('startupDisabledStatus'));
  } catch (error: unknown) {
    await loadStartupSettings();
    setStatusText(errorMessage(error, t('startupFailed')));
  } finally {
    startupBusy.value = false;
  }
}

// 读取局域网共享服务状态。
async function loadLanShareStatus() {
  try {
    const status = await window.companion.getLanShareStatus();
    applyLanShareStatus(status);
  } catch {
    applyLanShareStatus({ enabled: false });
  }
}

// 切换局域网共享，并同步保存设置。
async function refreshLanDevices() {
  try {
    const devices = await window.companion.getLanShareDevices?.();
    state.lanShare.devices = Array.isArray(devices) ? devices : [];
  } catch {
    state.lanShare.devices = [];
  }
}

async function sendToLanDevice(device: CompanionLanShareDevice) {
  if (!window.companion.sendLanShareToDevice) {
    setStatusText(t('lanSendFailed'));
    return;
  }

  lanSendingDeviceId.value = device.id;
  setStatusText(ft('lanSending', { device: device.name }));

  try {
    const result = await window.companion.sendLanShareToDevice(device.id);

    if (result?.canceled) {
      return;
    }

    setStatusText(ft('lanSent', {
      count: result?.count || 0,
      device: result?.deviceName || device.name
    }));
  } catch (error: unknown) {
    setStatusText(errorMessage(error, t('lanSendFailed')));
  } finally {
    lanSendingDeviceId.value = '';
  }
}

async function toggleLanShare() {
  lanBusy.value = true;

  try {
    const status = await window.companion.setLanShareEnabled(state.lanShare.enabled);
    applyLanShareStatus(status);
    await window.companion.saveSettings(buildSettingsPayload());
    setStatusText(status.enabled ? t('lanEnabledStatus') : t('lanDisabledStatus'));
  } catch (error: unknown) {
    await loadLanShareStatus();
    setStatusText(errorMessage(error, t('lanFailed')));
  } finally {
    lanBusy.value = false;
  }
}

// 切换低 CPU 模式并保存性能配置。
async function toggleLowCpuMode() {
  applyPerformanceValues({ performance: { lowCpuMode: state.lowCpuMode !== false } });
  await window.companion.saveSettings(buildSettingsPayload());
  setStatusText(t('performanceUpdated'));
}

// 切换使用说明语言，同时写入 localStorage。
function chooseGuideLanguage(language: string | undefined) {
  const nextLanguage = normalizeGuideLanguage(language) as GuideLanguage;
  state.guideLanguage = nextLanguage;
  localStorage.setItem(GUIDE_LANGUAGE_KEY, nextLanguage);
}

// 组件挂载后加载设置、系统状态和更新事件。
onMounted(() => {
  setStatusText(state.statusText || t('waitingKey'));

  Promise.all([
    loadSettings().catch((error: unknown) => {
      setStatusText(errorMessage(error, t('loadingConfigFailed')));
    }),
    loadStartupSettings().catch(() => null),
    loadLanShareStatus().catch(() => null)
  ]);

  refreshLanDevices().catch(() => null);

  removeLanDevicesListener = window.companion.onLanShareDevicesChanged?.((payload = {}) => {
    state.lanShare.devices = Array.isArray(payload.devices) ? payload.devices : [];
  });

  removeUpdateListener = window.companion.onUpdateStatus?.((status: CompanionUpdateStatus = {}) => {
    if (['available', 'downloading', 'downloaded', 'error'].includes(status.state)) {
      setStatusText(status.message || '');
    }
  });
});

// 组件卸载时释放更新事件监听。
onUnmounted(() => {
  removeUpdateListener?.();
  removeLanDevicesListener?.();
});
</script>

<template>
  <section class="settings-panel panel" :class="{ 'is-light': state.theme === 'light' }" @click="closeModelMenu()">
    <div class="panel-row">
      <h2>{{ t('interfaceTitle') }}</h2>
      <span class="status-text" id="settingsStatus">{{ statusText }}</span>
    </div>

    <div class="theme-switch" id="themeSwitch" aria-label="Theme" @click.stop>
      <button
        class="theme-choice"
        :class="{ 'is-active': state.theme === 'dark' }"
        id="themeDarkButton"
        type="button"
        @click="chooseTheme('dark')"
      >
        {{ t('dark') }}
      </button>
      <button
        class="theme-choice"
        :class="{ 'is-active': state.theme === 'light' }"
        id="themeLightButton"
        type="button"
        @click="chooseTheme('light')"
      >
        {{ t('light') }}
      </button>
    </div>

    <div class="provider-stack">
      <ProviderCard
        v-for="(provider, index) in state.providers"
        :key="provider.id"
        :provider="provider"
        :index="index"
        :model-list="state.modelLists[index]"
        :active="state.activeProviderIndex === index"
        :labels="providerLabels"
        @refresh="refreshModels"
        @toggle-menu="toggleModelMenu"
        @open-menu="openModelMenuIfLoaded"
        @select-model="selectModel"
        @update-field="updateProviderField"
      />
    </div>

    <section class="permission-card">
      <div class="provider-head">
        <strong>{{ t('workspace') }}</strong>
        <span id="workspaceAccessStatus">{{ state.computerAccess.enabled ? t('authorized') : t('unauthorized') }}</span>
      </div>

      <div class="permission-workspace">
        <label class="field">
          <span>{{ t('workspaceLabel') }}</span>
          <input
            id="workspaceRootInput"
            v-model="state.computerAccess.workspaceRoot"
            type="text"
            spellcheck="false"
            autocomplete="off"
            readonly
            :placeholder="t('workspacePlaceholder')"
          />
        </label>
        <button
          class="field-icon-button"
          id="chooseWorkspaceButton"
          type="button"
          :title="t('chooseWorkspace')"
          :aria-label="t('chooseWorkspace')"
          @click="chooseWorkspaceRoot"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 7h6l2 2h10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <path d="M3 7v11" />
          </svg>
        </button>
      </div>

      <div class="permission-actions">
        <button
          class="permission-link-button"
          id="clearWorkspaceButton"
          type="button"
          :disabled="!state.computerAccess.enabled"
          @click="clearWorkspaceAccess"
        >
          {{ t('clearWorkspace') }}
        </button>
      </div>

      <label class="permission-toggle">
        <input
          id="commandAccessToggle"
          v-model="state.computerAccess.allowCommands"
          type="checkbox"
          :disabled="!state.computerAccess.enabled"
          @change="toggleCommandAccess"
        />
        <span>{{ t('commandAccess') }}</span>
      </label>
    </section>

    <section class="system-card">
      <div class="provider-head">
        <strong>{{ t('system') }}</strong>
        <span id="startupLaunchStatus">{{ state.startupOpenAtLogin ? t('enabled') : t('disabled') }}</span>
      </div>
      <label class="permission-toggle">
        <input
          id="startupLaunchToggle"
          v-model="state.startupOpenAtLogin"
          type="checkbox"
          :disabled="startupBusy"
          @change="toggleStartupLaunch"
        />
        <span>{{ t('startup') }}</span>
      </label>
      <label class="permission-toggle">
        <input
          id="lowCpuModeToggle"
          v-model="state.lowCpuMode"
          type="checkbox"
          @change="toggleLowCpuMode"
        />
        <span>{{ t('lowCpu') }}</span>
      </label>
    </section>

    <section class="lan-card">
      <div class="provider-head">
        <strong>{{ t('lanShare') }}</strong>
        <div class="lan-head-actions">
          <span id="lanShareStatus">{{ state.lanShare.enabled ? t('enabled') : t('disabled') }}</span>
          <button
            v-if="state.lanShare.enabled"
            class="field-icon-button"
            id="lanRefreshButton"
            type="button"
            :aria-label="t('lanRefresh')"
            :title="t('lanRefresh')"
            @click.stop="refreshLanDevices"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M21 12a9 9 0 0 1-15.6 6.1M3 12a9 9 0 0 1 15.6-6.1M18 3v4h-4M6 21v-4h4" />
            </svg>
          </button>
        </div>
      </div>
      <label class="permission-toggle">
        <input
          id="lanShareToggle"
          v-model="state.lanShare.enabled"
          type="checkbox"
          :disabled="lanBusy"
          @change="toggleLanShare"
        />
        <span>{{ t('lanAllow') }}</span>
      </label>
      <div class="lan-share-url" id="lanShareUrl">{{ lanShareSummary }}</div>
      <div v-if="state.lanShare.enabled" class="lan-share-help">{{ t('lanDevicesHint') }}</div>
      <div v-if="state.lanShare.enabled" class="lan-share-diagnostics">{{ lanDiagnosticText }}</div>
      <div v-if="state.lanShare.enabled" class="lan-share-security">{{ lanSecurityText }}</div>
      <div v-if="state.lanShare.enabled && lanDevices.length === 0" class="lan-share-help">{{ lanTroubleshootingText }}</div>
      <div v-if="state.lanShare.enabled" class="lan-device-list">
        <button
          v-for="device in lanDevices"
          :key="device.id"
          class="lan-device-button"
          type="button"
          :disabled="Boolean(lanSendingDeviceId)"
          @click="sendToLanDevice(device)"
        >
          <span>
            <strong>{{ device.name }}</strong>
            <small>{{ ft('lanDeviceAddress', { address: device.address || '-' }) }}</small>
          </span>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 12h14M13 5l7 7-7 7" />
          </svg>
        </button>
        <div v-if="lanDevices.length === 0" class="lan-device-empty">{{ t('lanDevicesEmpty') }}</div>
      </div>
    </section>

    <section class="guide-card">
      <div class="provider-head">
        <strong>{{ t('guide') }}</strong>
        <div class="guide-tabs" aria-label="Guide language">
          <button
            v-for="language in ['zh', 'en', 'ja']"
            :key="language"
            class="guide-tab"
            :class="{ 'is-active': state.guideLanguage === language }"
            type="button"
            :data-guide-lang="language"
            @click="chooseGuideLanguage(language)"
          >
            {{ language === 'zh' ? '中文' : language === 'en' ? 'EN' : '日本語' }}
          </button>
        </div>
      </div>
      <div class="guide-body" id="guideBody">
        <div
          v-for="[title, body] in guideItems"
          :key="title"
          class="guide-item"
        >
          <strong>{{ title }}</strong>
          <p>{{ body }}</p>
        </div>
      </div>
    </section>

    <button
      class="command-button quiet"
      :class="{ 'is-loading': saveBusy }"
      id="saveSettingsButton"
      type="button"
      :disabled="saveBusy"
      @click="saveSettings"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 5a2 2 0 0 1 2-2h10l4 4v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM8 3v6h8V4M8 21v-7h8v7" />
      </svg>
      <span data-button-label>{{ saveBusy ? t('saving') : t('saveConfig') }}</span>
    </button>
  </section>
</template>


<style scoped lang="less">
.settings-panel {
  position: relative;
  z-index: 5;
  min-height: 0;
  height: fit-content;
}

.theme-switch {
  height: 30px;
  margin-top: 8px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  padding: 3px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.035);
}

.theme-choice {
  min-width: 0;
  border-radius: 6px;
  color: var(--muted);
  background: transparent;
  font-size: 11px;
  font-weight: 800;
  transition: color 120ms ease, background 120ms ease, box-shadow 120ms ease;
}

.theme-choice.is-active {
  color: var(--ink);
  background: rgba(255, 255, 255, 0.105);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.provider-stack {
  min-width: 0;
  display: grid;
  gap: 8px;
  margin-top: 8px;
}

.permission-card {
  min-width: 0;
  margin-top: 8px;
  padding: 8px;
  border: 1px solid rgba(106, 168, 255, 0.22);
  border-radius: 8px;
  background: linear-gradient(180deg, rgba(106, 168, 255, 0.06), rgba(255, 255, 255, 0.028));
  box-shadow: inset 3px 0 0 rgba(106, 168, 255, 0.32);
}

.provider-head {
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.provider-head strong {
  color: var(--ink);
  font-size: 12px;
  font-weight: 850;
  line-height: 16px;
}

.provider-head span {
  min-width: 0;
  overflow: hidden;
  color: var(--muted);
  font-size: 10px;
  font-weight: 700;
  line-height: 14px;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.system-card,
.lan-card,
.guide-card {
  min-width: 0;
  margin-top: 8px;
  padding: 8px;
  border: 1px solid rgba(157, 178, 194, 0.16);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.032);
}

.system-card {
  box-shadow: inset 3px 0 0 rgba(157, 178, 194, 0.24);
}

.lan-card {
  border-color: rgba(106, 168, 255, 0.2);
  box-shadow: inset 3px 0 0 rgba(106, 168, 255, 0.26);
}

.lan-head-actions {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
}

.lan-head-actions .field-icon-button {
  width: 24px;
  height: 24px;
  border-radius: 6px;
}

.lan-head-actions .field-icon-button svg {
  width: 13px;
  height: 13px;
}

.lan-share-url {
  min-width: 0;
  margin-top: 4px;
  padding: 7px 8px;
  border: 1px solid rgba(157, 178, 194, 0.16);
  border-radius: 7px;
  color: var(--muted);
  background: rgba(255, 255, 255, 0.032);
  font-size: 10.5px;
  font-weight: 700;
  line-height: 15px;
  overflow-wrap: anywhere;
}

.lan-share-help {
  min-width: 0;
  margin-top: 6px;
  color: var(--muted);
  font-size: 10px;
  font-weight: 650;
  line-height: 14px;
}

.lan-share-diagnostics,
.lan-share-security {
  min-width: 0;
  margin-top: 6px;
  padding: 7px 8px;
  border: 1px solid rgba(157, 178, 194, 0.14);
  border-radius: 7px;
  color: var(--muted);
  background: rgba(255, 255, 255, 0.025);
  font-size: 9.8px;
  font-weight: 650;
  line-height: 14px;
  overflow-wrap: anywhere;
}

.lan-share-security {
  border-color: rgba(67, 240, 206, 0.18);
  color: rgba(168, 255, 243, 0.78);
  background: rgba(67, 240, 206, 0.045);
}

.lan-device-list {
  min-width: 0;
  display: grid;
  gap: 6px;
  margin-top: 7px;
}

.lan-device-button {
  min-width: 0;
  min-height: 42px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 18px;
  align-items: center;
  gap: 8px;
  padding: 7px 8px;
  border: 1px solid rgba(106, 168, 255, 0.2);
  border-radius: 8px;
  color: var(--ink);
  background: rgba(106, 168, 255, 0.06);
  text-align: left;
  transition: color 120ms ease, border-color 120ms ease, background 120ms ease, transform 120ms var(--ease-snap);
}

.lan-device-button > span {
  min-width: 0;
  display: grid;
  gap: 2px;
}

.lan-device-button strong,
.lan-device-button small {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.lan-device-button strong {
  font-size: 11px;
  font-weight: 850;
  line-height: 15px;
}

.lan-device-button small {
  color: var(--muted);
  font-size: 9.5px;
  font-weight: 650;
  line-height: 13px;
}

.lan-device-button svg {
  width: 16px;
  height: 16px;
  color: var(--muted);
  stroke-width: 2;
}

.lan-device-button:hover:not(:disabled) {
  border-color: rgba(67, 240, 206, 0.38);
  background: rgba(67, 240, 206, 0.09);
  transform: translateY(-1px);
}

.lan-device-button:hover:not(:disabled) svg {
  color: var(--accent);
}

.lan-device-button:disabled {
  cursor: wait;
  opacity: 0.52;
}

.lan-device-empty {
  min-width: 0;
  padding: 8px;
  border: 1px dashed rgba(157, 178, 194, 0.18);
  border-radius: 8px;
  color: var(--muted);
  background: rgba(255, 255, 255, 0.025);
  font-size: 10px;
  font-weight: 700;
  line-height: 14px;
  text-align: center;
}

.guide-card {
  border-color: rgba(67, 240, 206, 0.18);
  box-shadow: inset 3px 0 0 rgba(67, 240, 206, 0.26);
}

.guide-tabs {
  min-width: 0;
  display: inline-flex;
  gap: 4px;
}

.guide-tab {
  height: 22px;
  min-width: 34px;
  padding: 0 7px;
  border: 1px solid rgba(157, 178, 194, 0.16);
  border-radius: 6px;
  color: var(--muted);
  background: rgba(255, 255, 255, 0.035);
  font-size: 10px;
  font-weight: 850;
}

.guide-tab.is-active,
.guide-tab:hover {
  color: var(--accent);
  border-color: rgba(67, 240, 206, 0.34);
  background: rgba(67, 240, 206, 0.09);
}

.guide-body {
  min-width: 0;
  display: grid;
  gap: 7px;
  margin-top: 8px;
}

.guide-item {
  min-width: 0;
  display: grid;
  gap: 2px;
}

.guide-item strong {
  color: var(--ink);
  font-size: 11px;
  font-weight: 850;
  line-height: 15px;
}

.guide-item p {
  margin: 0;
  color: var(--muted);
  font-size: 10.5px;
  font-weight: 650;
  line-height: 15px;
}

.permission-toggle {
  min-width: 0;
  height: 28px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--muted);
  font-size: 11px;
  font-weight: 750;
}

.permission-toggle input {
  width: 14px;
  height: 14px;
  accent-color: var(--accent);
}

.permission-workspace {
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 32px;
  align-items: end;
  gap: 6px;
  margin: 4px 0;
}

.field {
  min-width: 0;
  display: grid;
  gap: 5px;
  color: #a7b4c0;
  font-size: 11px;
  font-weight: 700;
}

.field input {
  width: 100%;
  min-width: 0;
  height: 32px;
  padding: 0 9px;
  border: 1px solid rgba(157, 178, 194, 0.2);
  border-radius: 7px;
  outline: 0;
  color: var(--ink);
  background: rgba(3, 7, 12, 0.62);
  font-size: 12px;
  transition: border-color 120ms ease, box-shadow 120ms ease, background 120ms ease;
}

.field input::placeholder {
  color: #526170;
}

.field input:focus {
  border-color: rgba(67, 240, 206, 0.58);
  box-shadow: 0 0 0 3px rgba(67, 240, 206, 0.1);
  background: rgba(5, 9, 15, 0.78);
}

.permission-actions {
  min-width: 0;
  display: flex;
  justify-content: flex-end;
  margin: 0 0 4px;
}

.permission-link-button {
  min-width: 0;
  border: 0;
  padding: 0;
  color: var(--muted);
  background: transparent;
  font-size: 10px;
  font-weight: 800;
  line-height: 16px;
  cursor: pointer;
}

.permission-link-button:hover:not(:disabled) {
  color: var(--accent);
}

.permission-link-button:disabled {
  opacity: 0.45;
  cursor: default;
}

.field-icon-button {
  width: 32px;
  height: 32px;
  display: inline-grid;
  place-items: center;
  border: 1px solid rgba(157, 178, 194, 0.2);
  border-radius: 7px;
  color: #99a7b4;
  background: rgba(255, 255, 255, 0.045);
  transform: translateZ(0);
  transition: color 120ms ease, border-color 120ms ease, background 120ms ease, transform 120ms var(--ease-snap);
}

.field-icon-button svg {
  width: 15px;
  height: 15px;
}

.field-icon-button:hover:not(:disabled) {
  color: var(--accent);
  border-color: rgba(67, 240, 206, 0.38);
  background: rgba(67, 240, 206, 0.1);
}

.field-icon-button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.status-text,
.inline-status {
  min-width: 0;
  overflow: hidden;
  color: var(--muted);
  font-size: 11px;
  line-height: 18px;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.settings-panel.is-light{
  background: linear-gradient(180deg, rgba(255, 250, 239, 0.97), rgba(238, 244, 239, 0.91));
}

.settings-panel.is-light .theme-switch{
  border-color: rgba(58, 59, 51, 0.14);
  background: rgba(221, 228, 221, 0.72);
  box-shadow: inset 0 1px 2px rgba(38, 35, 29, 0.08);
}

.settings-panel.is-light .theme-choice{
  color: #6f7771;
}

.settings-panel.is-light .theme-choice.is-active{
  color: #241b18;
  background: linear-gradient(180deg, rgba(255, 248, 236, 0.98), rgba(240, 225, 214, 0.94));
  box-shadow: 0 7px 14px rgba(91, 57, 48, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.82);
}

.settings-panel.is-light .permission-card{
  border-color: rgba(106, 168, 255, 0.22);
  background: linear-gradient(180deg, rgba(231, 239, 255, 0.88), rgba(255, 248, 236, 0.82));
  box-shadow: inset 3px 0 0 rgba(106, 168, 255, 0.34), 0 8px 18px rgba(52, 45, 35, 0.06);
}

.settings-panel.is-light .provider-head strong{
  color: #18221f;
}

.settings-panel.is-light .provider-head span,
.settings-panel.is-light .field,
.settings-panel.is-light .permission-toggle,
.settings-panel.is-light .permission-link-button {
  color: #6b746f;
}

.settings-panel.is-light .field input {
  border-color: rgba(54, 59, 52, 0.16);
  color: #1d2926;
  background: linear-gradient(180deg, rgba(255, 253, 247, 0.92), rgba(244, 247, 243, 0.86));
}

.settings-panel.is-light .field input::placeholder {
  color: #8b938b;
}

.settings-panel.is-light .field input:focus {
  border-color: rgba(214, 63, 99, 0.34);
  background: rgba(255, 252, 246, 0.96);
  box-shadow: 0 0 0 3px rgba(214, 63, 99, 0.09);
}

.settings-panel.is-light .system-card,
.settings-panel.is-light .lan-card,
.settings-panel.is-light .guide-card{
  border-color: rgba(54, 59, 52, 0.14);
  background: rgba(255, 253, 247, 0.82);
  box-shadow: inset 3px 0 0 rgba(20, 121, 111, 0.2), 0 8px 18px rgba(52, 45, 35, 0.05);
}

.settings-panel.is-light .lan-share-url,
.settings-panel.is-light .lan-share-help,
.settings-panel.is-light .lan-share-diagnostics,
.settings-panel.is-light .lan-device-button small,
.settings-panel.is-light .lan-device-empty {
  color: #6b746f;
}

.settings-panel.is-light .lan-share-url {
  border-color: rgba(54, 59, 52, 0.14);
  background: rgba(250, 248, 240, 0.68);
}

.settings-panel.is-light .lan-share-diagnostics {
  border-color: rgba(54, 59, 52, 0.12);
  background: rgba(250, 248, 240, 0.54);
}

.settings-panel.is-light .lan-share-security {
  color: #14796f;
  border-color: rgba(20, 121, 111, 0.16);
  background: rgba(229, 244, 238, 0.58);
}

.settings-panel.is-light .lan-device-button {
  color: #18221f;
  border-color: rgba(20, 121, 111, 0.18);
  background: rgba(229, 244, 238, 0.6);
}

.settings-panel.is-light .lan-device-button:hover:not(:disabled) {
  border-color: rgba(214, 63, 99, 0.28);
  background: rgba(255, 232, 224, 0.72);
}

.settings-panel.is-light .lan-device-empty {
  border-color: rgba(54, 59, 52, 0.14);
  background: rgba(250, 248, 240, 0.54);
}

.settings-panel.is-light .field-icon-button {
  color: #596662;
  border-color: rgba(54, 59, 52, 0.15);
  background: rgba(250, 248, 240, 0.74);
}

.settings-panel.is-light .field-icon-button:hover:not(:disabled) {
  color: var(--accent);
  border-color: rgba(214, 63, 99, 0.28);
  background: rgba(255, 232, 224, 0.72);
}

.settings-panel.is-light .command-button.quiet {
  border-color: rgba(214, 63, 99, 0.28);
  color: #8f203d;
  background: linear-gradient(180deg, rgba(255, 239, 230, 0.94), rgba(248, 221, 214, 0.9));
  box-shadow: 0 9px 18px rgba(120, 57, 50, 0.1);
}

.settings-panel.is-light .command-button.quiet:hover:not(:disabled) {
  border-color: rgba(214, 63, 99, 0.44);
  background: linear-gradient(180deg, rgba(255, 244, 235, 0.98), rgba(252, 226, 218, 0.96));
}
</style>
