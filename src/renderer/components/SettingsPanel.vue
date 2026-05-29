<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import ProviderCard from '@/renderer/components/ProviderCard.vue';
import { companionState, setBusy, setStatusText } from '@/renderer/composables/companionState';
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
// 更新状态监听的清理函数，组件卸载时取消订阅。
let removeUpdateListener: (() => void) | undefined;

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
const lanShareUrl = computed(() => {
  if (!state.lanShare.enabled) {
    return t('lanUrlIdle');
  }

  return state.lanShare.urls[0] || t('lanNoAddress');
});

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

  removeUpdateListener = window.companion.onUpdateStatus?.((status: CompanionUpdateStatus = {}) => {
    if (['available', 'downloading', 'downloaded', 'error'].includes(status.state)) {
      setStatusText(status.message || '');
    }
  });
});

// 组件卸载时释放更新事件监听。
onUnmounted(() => {
  removeUpdateListener?.();
});
</script>

<template>
  <section class="settings-panel panel" @click="closeModelMenu()">
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
        <span id="lanShareStatus">{{ state.lanShare.enabled ? t('enabled') : t('disabled') }}</span>
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
      <div class="lan-share-url" id="lanShareUrl">{{ lanShareUrl }}</div>
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
