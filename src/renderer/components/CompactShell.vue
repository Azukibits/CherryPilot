<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import CherryMark from '@/renderer/components/CherryMark.vue';
import HiddenFileInput from '@/renderer/components/HiddenFileInput.vue';
import HistoryPanel from '@/renderer/components/HistoryPanel.vue';
import { companionState, setCompactAnswer, type HistoryEntry } from '@/renderer/composables/companionState';
import { textFor } from '@/renderer/composables/companionText';
import { askFromCompact } from '@/renderer/composables/useAssistant';
import {
  clearScreenshot,
  closeScreenshotPreview,
  contextStatusText,
  ingestFileList,
  openScreenshotPreview,
  selectRegion,
  triggerFilePicker
} from '@/renderer/composables/useContextSources';
import {
  getCombinedModelOptions,
  selectCompactModel,
  toggleCompactModelPanel
} from '@/renderer/composables/useCompactModels';
import { getHistoryAnswerText } from '@/renderer/composables/useHistory';
import { toggleVoiceInput } from '@/renderer/composables/useVoice';
import {
  applyWindowMode,
  handleAgentPointerCancel,
  handleAgentPointerDown,
  handleAgentPointerMove,
  handleAgentPointerUp,
  openMainPanel,
  showExitContextBlock,
  toggleAnswerZoom
} from '@/renderer/composables/useWindowMode';

// 组件直接使用全局伴随状态，保持浮窗 UI 与其他面板同步。
const state = companionState;
// 紧凑输入框引用，用于发送后或浮窗展开后恢复焦点。
const promptRef = ref<HTMLInputElement | null>(null);
// 隐藏文件输入组件引用，作为系统文件选择器的浏览器兜底入口。
const fileInputRef = ref<InstanceType<typeof HiddenFileInput> | null>(null);

// 当前语言的文本读取器，模板和方法共用。
const t = (key: Parameters<typeof textFor>[1]) => textFor(state.guideLanguage, key);

// 回答区兜底文本，避免空内容时出现空白浮窗。
const answerText = computed(() => state.answerContent || t('waitingQuestion'));
// 合并所有已配置接口的模型选项，供紧凑模型面板展示。
const compactModelOptions = computed(() => getCombinedModelOptions());

// 等待 DOM 更新后聚焦输入框，防止浮窗刚展开时焦点丢失。
function focusPrompt() {
  nextTick(() => promptRef.value?.focus());
}

// 打开文件来源：优先调用 Electron 文件选择，缺失时回退到隐藏 input。
async function openFileSources() {
  await triggerFilePicker(() => fileInputRef.value?.open());
}

// 关闭整个应用窗口。
function closeWindow() {
  window.companion.closeWindow();
}

// 切换紧凑历史面板，并关闭会互相遮挡的模型/截图面板。
function toggleHistoryPanel(event: Event) {
  event.preventDefault();
  event.stopPropagation();

  if (state.compactHistoryPanelOpen) {
    state.compactHistoryPanelOpen = false;
    return;
  }

  state.compactModelPanelOpen = false;
  state.screenshotPreviewOpen = false;
  state.compactHistoryPanelOpen = true;
}

// 将历史记录重新放入回答区；zoom 为 true 时直接进入放大阅读。
async function openHistoryInAnswer(item: HistoryEntry, zoom: boolean) {
  setCompactAnswer(getHistoryAnswerText(item), false, item.imageUrl || '');
  state.compactPrompt = item.question || '';
  state.compactHistoryPanelOpen = false;

  if (zoom) {
    const modeState = await window.companion.setAnswerZoom(true);
    applyWindowMode(modeState);
    return;
  }

  focusPrompt();
}

// 从紧凑输入框发起一次提问，并在完成后恢复输入焦点。
async function submitPrompt() {
  await askFromCompact();
  focusPrompt();
}

// Enter 发送，Shift+Enter 保留给未来多行输入扩展。
function handlePromptKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    submitPrompt();
  }
}

// 浮窗展开且不处于放大阅读时，自动把焦点交回输入框。
watch(
  () => [state.windowMode, state.revealed, state.answerZoomed],
  ([mode, revealed, zoomed]) => {
    if (mode === 'compact' && revealed && !zoomed) {
      focusPrompt();
    }
  }
);
</script>

<template>
  <section id="compactShell" class="compact-shell">
    <div class="compact-agent-zone">
      <button
        id="agentIcon"
        class="agent-icon"
        type="button"
        aria-label="CherryPilot"
        @contextmenu="showExitContextBlock"
        @pointerdown="handleAgentPointerDown"
        @pointermove="handleAgentPointerMove"
        @pointerup="handleAgentPointerUp"
        @pointercancel="handleAgentPointerCancel"
        @lostpointercapture="handleAgentPointerCancel"
      >
        <svg class="agent-mark" viewBox="0 0 48 48" aria-hidden="true">
          <CherryMark />
        </svg>
        <span class="status-dot"></span>
      </button>
    </div>

    <div class="compact-orbit">
      <button
        id="compactModelButton"
        class="compact-action"
        :class="{ 'is-active': state.compactModelPanelOpen, 'is-loading': state.compactModelLoading }"
        type="button"
        :title="t('switchModel')"
        :aria-label="t('switchModel')"
        :data-tooltip="t('switchModel')"
        @click.stop="toggleCompactModelPanel"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 7h16M7 12h10M10 17h4" />
        </svg>
      </button>

      <button
        id="compactShotButton"
        class="compact-action"
        type="button"
        :title="t('screenshot')"
        :aria-label="t('screenshot')"
        :data-tooltip="t('screenshot')"
        @click.stop="selectRegion"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" />
          <path d="M9 9h6v6H9z" />
        </svg>
      </button>

      <button
        id="compactFileButton"
        class="compact-action"
        type="button"
        :title="t('file')"
        :aria-label="t('file')"
        :data-tooltip="t('file')"
        @click.stop="openFileSources"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
          <path d="M14 3v6h6" />
        </svg>
      </button>

      <button
        id="compactMicButton"
        class="compact-action"
        :class="{
          'is-active': state.isRecording,
          'is-recording': state.isRecording,
          'is-awake': state.voiceAwake,
          'is-processing': state.voiceProcessing
        }"
        type="button"
        :title="t('voice')"
        :aria-label="t('voice')"
        :data-tooltip="t('voice')"
        @click.stop="toggleVoiceInput"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z" />
          <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
        </svg>
      </button>

      <button
        id="compactOpenButton"
        class="compact-action"
        type="button"
        :title="t('openMain')"
        :aria-label="t('openMain')"
        :data-tooltip="t('openMain')"
        @click.stop="openMainPanel"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 5h14v14H5z" />
          <path d="M9 9h6v6H9z" />
        </svg>
      </button>

      <button
        id="compactExitButton"
        class="compact-action compact-context-action"
        type="button"
        :title="t('exit')"
        :aria-label="t('exit')"
        :data-tooltip="t('exit')"
        @click.stop="closeWindow"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>
    </div>

    <div class="compact-tools">
      <div class="compact-input-row">
        <input
          id="compactPromptInput"
          ref="promptRef"
          v-model="state.compactPrompt"
          type="text"
          spellcheck="false"
          autocomplete="off"
          :placeholder="t('prompt')"
          @keydown="handlePromptKeydown"
        />
        <button
          id="compactSendButton"
          class="compact-send"
          :class="{ 'is-loading': state.isBusy }"
          type="button"
          :title="t('send')"
          :aria-label="t('send')"
          :disabled="state.isBusy"
          @click.stop="submitPrompt"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 12h14M13 5l7 7-7 7" />
          </svg>
        </button>
        <button
          id="compactHistoryButton"
          class="compact-history-button"
          :class="{ 'is-active': state.compactHistoryPanelOpen }"
          type="button"
          :title="t('history')"
          :aria-label="t('history')"
          @click.stop="toggleHistoryPanel"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 5h16M4 12h16M4 19h10" />
          </svg>
        </button>
      </div>

      <div
        id="compactModelPanel"
        class="compact-model-panel"
        :hidden="!state.compactModelPanelOpen"
        @click.stop
      >
        <template v-if="compactModelOptions.length > 0">
          <button
            v-for="option in compactModelOptions"
            :key="`${option.slotIndex}:${option.model}`"
            class="compact-model-option"
            :class="{ 'is-active': option.slotIndex === state.activeProviderIndex && state.providers[option.slotIndex].model === option.model }"
            type="button"
            :title="`${option.providerName} / ${option.model}`"
            @click.stop="selectCompactModel(option)"
          >
            <span>{{ option.providerName }}</span>
            <strong>{{ option.model }}</strong>
          </button>
        </template>
        <div v-else class="compact-model-empty">
          {{ state.compactModelPanelMessage || t('compactModelNeedConfig') }}
        </div>
      </div>

      <section
        id="compactHistoryPanel"
        class="compact-history-panel"
        :hidden="!state.compactHistoryPanelOpen"
        @click.stop
      >
        <HistoryPanel compact @open-answer="openHistoryInAnswer" />
      </section>

      <div class="compact-topline" hidden>
        <div id="compactContextStatus" class="compact-context">
          {{ contextStatusText }}
        </div>
      </div>

      <div
        id="compactScreenshotStrip"
        class="compact-screenshot-strip"
        :hidden="!state.screenshotDataUrl"
      >
        <button
          id="compactScreenshotPreviewButton"
          class="compact-screenshot-thumb"
          :class="{ 'is-active': state.screenshotPreviewOpen }"
          type="button"
          :title="t('screenshotPreview')"
          :aria-label="t('screenshotPreview')"
          @click.stop="openScreenshotPreview"
        >
          <img
            id="compactScreenshotThumb"
            :src="state.screenshotDataUrl"
            :alt="t('screenshotPreview')"
          />
          <span>{{ t('screenshotChip') }}</span>
        </button>
        <button
          id="compactScreenshotDeleteButton"
          class="compact-screenshot-delete"
          type="button"
          :title="t('deleteScreenshot')"
          :aria-label="t('deleteScreenshot')"
          @click.stop="clearScreenshot"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 6h18M8 6V4h8v2M7 6l1 15h8l1-15" />
          </svg>
        </button>
      </div>

      <section
        id="compactScreenshotPreviewPanel"
        class="compact-screenshot-preview"
        :hidden="!state.screenshotPreviewOpen"
        @click.stop
      >
        <div class="compact-screenshot-preview-bar">
          <strong>{{ t('screenshotPreview') }}</strong>
          <div>
            <button
              id="compactScreenshotPreviewDeleteButton"
              class="history-icon-button"
              type="button"
              :title="t('deleteScreenshot')"
              :aria-label="t('deleteScreenshot')"
              @click.stop="clearScreenshot"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3 6h18M8 6V4h8v2M7 6l1 15h8l1-15" />
              </svg>
            </button>
            <button
              id="compactScreenshotPreviewCloseButton"
              class="history-icon-button"
              type="button"
              :title="t('closePreview')"
              :aria-label="t('closePreview')"
              @click.stop="closeScreenshotPreview"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
        </div>
        <img
          id="compactScreenshotPreviewImage"
          :src="state.screenshotDataUrl"
          :alt="t('screenshotPreview')"
        />
      </section>

      <button
        id="compactAnswerExpandButton"
        class="answer-expand-button"
        :class="{ 'is-active': state.answerZoomed }"
        type="button"
        :title="t('historyExpand')"
        :aria-label="t('historyExpand')"
        @click.stop="toggleAnswerZoom"
      >
        <svg class="expand-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8 3H3v5M16 21h5v-5M3 3l7 7M21 21l-7-7" />
        </svg>
        <svg class="restore-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9 9H4V4M4 9l5-5M15 15h5v5M20 15l-5 5" />
        </svg>
      </button>

      <div
        id="compactAnswerBox"
        class="compact-answer"
        :class="{ 'is-pending': state.answerPending }"
      >
        <div class="compact-answer-text">{{ answerText }}</div>
        <img
          v-if="state.answerImageUrl"
          class="compact-generated-image"
          :src="state.answerImageUrl"
          :alt="answerText"
        />
      </div>
    </div>

    <HiddenFileInput ref="fileInputRef" @files-selected="ingestFileList" />
  </section>
</template>
