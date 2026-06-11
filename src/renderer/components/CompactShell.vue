<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import CherryMark from '@/renderer/components/CherryMark.vue';
import HiddenFileInput from '@/renderer/components/HiddenFileInput.vue';
import HistoryPanel from '@/renderer/components/HistoryPanel.vue';
import { companionState, setCompactAnswer, type HistoryEntry } from '@/renderer/stores/companion';
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
const shellClasses = computed(() => {
  const compact = state.windowMode === 'compact';

  return {
    'is-light': state.theme === 'light',
    'is-revealed': compact && state.revealed,
    'is-concealed': compact && !state.revealed,
    'is-dock-left': compact && state.dockSide === 'left',
    'is-answer-zoomed': compact && state.answerZoomed,
    'is-dragging': state.dragging,
    'has-screenshot': Boolean(state.screenshotDataUrl),
    'is-context-menu-open': compact && state.contextMenuOpen,
    'is-voice-listening': compact && state.isRecording && !state.voiceAwake,
    'is-voice-awake': compact && state.isRecording && state.voiceAwake
  };
});
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
  <section
    id="compactShell"
    class="compact-shell"
    :class="shellClasses"
  >
    <div
      class="compact-agent-zone"
      :class="{ 'hide-zone': state.revealAnimation }"
    >
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
        v-show="state.compactModelPanelOpen"
        id="compactModelPanel"
        class="compact-model-panel"
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
        v-show="state.compactHistoryPanelOpen"
        id="compactHistoryPanel"
        class="compact-history-panel"
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
        v-show="state.screenshotDataUrl"
        id="compactScreenshotStrip"
        class="compact-screenshot-strip"
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
        v-show="state.screenshotPreviewOpen"
        id="compactScreenshotPreviewPanel"
        class="compact-screenshot-preview"
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


<style scoped lang="less">
.compact-shell {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 6px;
  overflow: hidden;
  border: 1px solid rgba(137, 255, 232, 0.2);
  border-radius: 16px;
  background:
    linear-gradient(180deg, rgba(22, 29, 38, 0.78), rgba(6, 9, 13, 0.68));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.11);
  clip-path: inset(0 round 16px);
  backdrop-filter: none;
  contain: layout paint;
  -webkit-app-region: no-drag;

  &.is-revealed {
    display: block;
    padding: 0;
    overflow: visible;
    border: 0;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
    clip-path: none;
    backdrop-filter: none;
    contain: layout;

    .compact-agent-zone {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      flex-basis: auto;
      pointer-events: none;
    }

    .agent-icon {
      position: absolute;
      left: 127px;
      top: 53px;
      pointer-events: auto;
    }
  }

  &.is-concealed {
    width: 52px;
    height: 52px;
    align-items: center;
    justify-content: center;
    padding: 3px;
    overflow: visible;
    border-color: transparent;
    border-radius: 16px;
    background: transparent;
    box-shadow: none;
    clip-path: none;

    .compact-agent-zone {
      position: relative;
      z-index: 2;
      width: 46px;
      height: 46px;
      flex: 0 0 46px;
      display: grid;
      place-items: center;
      pointer-events: auto !important;
    }

    .agent-icon {
      display: grid;
      opacity: 1;
      visibility: visible;
      border-radius: 14px;
    }

    .compact-tools {
      display: none;
      width: 0;
      flex: 0 0 0;
      opacity: 0;
      pointer-events: none;
      transform: translateX(-6px);
    }

    .compact-orbit {
      display: none;
    }
  }

  &.is-dock-left.is-concealed {
    .compact-tools {
      transform: translateX(6px);
    }
  }

  &.is-dragging {
    border-color: rgba(67, 240, 206, 0.58);
    box-shadow:
      var(--shadow-window),
      0 0 34px rgba(67, 240, 206, 0.2);
  }

  &.is-context-menu-open {
    .compact-context-action {
      display: grid;
      color: var(--danger);
      border-color: rgba(255, 96, 120, 0.42);
      background: rgba(255, 96, 120, 0.12);
    }

    .compact-tools,
    .compact-action:not(#compactExitButton ) {
      display: none !important;
    }

    #compactExitButton {
      left: 84px;
      top: 60px;
      display: grid !important;
      color: var(--danger);
      border-color: rgba(255, 96, 120, 0.48);
      background: rgba(255, 96, 120, 0.14);
    }
  }

  &.is-voice-listening .agent-icon,
  &.is-voice-awake .agent-icon {
    border-color: rgba(255, 92, 130, 0.42);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.18),
      0 16px 34px rgba(0, 0, 0, 0.34),
      0 0 24px rgba(255, 92, 130, 0.2);
  }

  &.is-voice-awake .agent-icon {
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.2),
      0 18px 38px rgba(0, 0, 0, 0.36),
      0 0 30px rgba(255, 92, 130, 0.32);
  }

  &.has-screenshot {
    .compact-answer {
      top: 82px;
    }
  }

  .agent-icon:hover {
    transform: none;
  }
}

.compact-agent-zone {
  position: relative;
  width: 46px;
  height: 46px;
  flex: 0 0 46px;
  display: grid;
  place-items: center;
}
.hide-zone{
  opacity: 0;
  pointer-events: none !important;
}
.agent-icon {
  position: relative;
  width: 46px;
  height: 46px;
  flex: 0 0 46px;
  display: grid;
  place-items: center;
  padding: 0;
  overflow: hidden;
  border: 1px solid rgba(255, 77, 122, 0.34);
  border-radius: 14px;
  color: #effffb;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.16), transparent 34%),
    radial-gradient(circle at 46% 60%, rgba(255, 77, 122, 0.19), transparent 42%),
    radial-gradient(circle at 62% 28%, rgba(56, 215, 135, 0.12), transparent 34%),
    linear-gradient(145deg, #171922 0%, #090d13 52%, #14111e 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.18),
    inset 0 -12px 20px rgba(0, 0, 0, 0.28),
    0 12px 24px rgba(0, 0, 0, 0.32),
    0 0 26px rgba(255, 77, 122, 0.13);
  transform: translateZ(0);
  will-change: transform;
  transition: transform 140ms var(--ease-snap), border-color 140ms ease, box-shadow 140ms ease;

  &::before {
    content: "";
    position: absolute;
    inset: 5px;
    border: 1px solid rgba(196, 255, 245, 0.16);
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.035);
    pointer-events: none;
  }

  &:hover {
    transform: translateY(-1px);
    border-color: rgba(255, 77, 122, 0.62);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.2),
      0 14px 30px rgba(0, 0, 0, 0.34),
      0 0 22px rgba(255, 77, 122, 0.18);
  }
}

.agent-mark {
  width: 31px;
  height: 31px;
  position: relative;
  z-index: 1;
  stroke-width: 1.75;
  filter: drop-shadow(0 0 8px rgba(255, 77, 122, 0.3));
}

.agent-mark,
.brand-mark {
  .pixel-frame {
    fill: rgba(235, 255, 250, 0.92);
  }

  .pixel-core {
    fill: var(--cherry);
  }

  .pixel-soft {
    fill: rgba(255, 77, 122, 0.2);
  }
}

.status-dot {
  position: absolute;
  right: 7px;
  bottom: 7px;
  width: 8px;
  height: 8px;
  border: 2px solid #0c1117;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 12px rgba(67, 240, 206, 0.82);
}

.compact-tools {
  min-width: 0;
  flex: 1;
  position: absolute;
  left: 186px;
  right: 8px;
  top: 53px;
  bottom: 8px;
  display: block;
  opacity: 1;
  transform: translateX(0);
  will-change: opacity, transform;
  transition: opacity 140ms var(--ease-out), transform 140ms var(--ease-out);
}

.compact-orbit {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.compact-topline {
  position: absolute;
  left: 0;
  right: 0;
  top: 42px;
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
}

.compact-context {
  min-width: 0;
  height: 30px;
  display: inline-flex;
  align-items: center;
  padding: 0 10px;
  border: 1px solid rgba(157, 178, 194, 0.16);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
  overflow: hidden;
  color: #aebdcc;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.compact-action {
  position: absolute;
  z-index: 20;
  width: 36px;
  height: 36px;
  flex: 0 0 36px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(157, 178, 194, 0.16);
  border-radius: 50%;
  color: #aebdcc;
  background: rgba(255, 255, 255, 0.045);
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.09);
  pointer-events: auto;
  transform: translateZ(0);
  will-change: transform;
  transition: color 120ms ease, border-color 120ms ease, background 120ms ease, transform 120ms var(--ease-snap);

  svg {
    width: 14px;
    height: 14px;
  }

  &:hover,
  &.is-active {
    z-index: 28;
    color: var(--accent);
    border-color: rgba(67, 240, 206, 0.34);
    background: rgba(67, 240, 206, 0.1);
    transform: translateZ(0);
  }

  &.is-loading svg {
    animation: spin 900ms linear infinite;
  }

  &::after {
    content: attr(data-tooltip);
    position: absolute;
    left: 44px;
    top: 50%;
    z-index: 30;
    height: 24px;
    display: inline-flex;
    align-items: center;
    padding: 0 9px;
    border: 1px solid rgba(157, 178, 194, 0.18);
    border-radius: 7px;
    color: var(--ink);
    background: rgba(8, 12, 18, 0.92);
    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.28);
    font-size: 11px;
    font-weight: 750;
    line-height: 1;
    white-space: nowrap;
    opacity: 0;
    pointer-events: none;
    transform: translate3d(-4px, -50%, 0);
    transition: opacity 110ms ease, transform 110ms var(--ease-out);
  }

  &:hover::after,
  &:focus-visible::after {
    opacity: 1;
    transform: translate3d(0, -50%, 0);
  }
}

#compactModelButton {
  left: 132px;
  top: 3px;
}

#compactShotButton {
  left: 84px;
  top: 18px;
}

#compactFileButton {
  left: 58px;
  top: 60px;
}

#compactMicButton {
  left: 84px;
  top: 102px;

  &.is-recording {
    color: var(--danger);
    border-color: rgba(255, 96, 120, 0.42);
    background: rgba(255, 96, 120, 0.12);
  }
}

#compactOpenButton::after,
#compactExitButton::after {
  left: auto;
  right: 44px;
}

#compactOpenButton,
#compactExitButton {
  left: 132px;
  top: 116px;
  bottom: auto;
}

.compact-context-action {
  display: none;
}

.compact-input-row {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 34px 34px;
  gap: 6px;
}

#compactPromptInput {
  width: 100%;
  height: 34px;
  min-width: 0;
  padding: 0 10px;
  border: 1px solid rgba(157, 178, 194, 0.2);
  border-radius: 8px;
  outline: 0;
  color: var(--ink);
  background: rgba(3, 7, 12, 0.62);
  font-size: 12px;

  &:focus {
    border-color: rgba(67, 240, 206, 0.58);
    box-shadow: 0 0 0 3px rgba(67, 240, 206, 0.1);
  }
}

.compact-send {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(67, 240, 206, 0.28);
  border-radius: 8px;
  color: #04110e;
  background: linear-gradient(180deg, #8ffff0, var(--accent));

  svg {
    width: 15px;
    height: 15px;
  }

  &:hover:not(:disabled) {
    background: linear-gradient(180deg, #a8fff3, #54f4d4);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.58;
  }

  &.is-loading svg {
    animation: spin 900ms linear infinite;
  }
}

.compact-model-panel {
  position: absolute;
  left: 0;
  right: 0;
  top: 38px;
  z-index: 60;
  max-height: 136px;
  display: grid;
  gap: 5px;
  overflow: auto;
  padding: 6px;
  border: 1px solid rgba(157, 178, 194, 0.22);
  border-radius: 8px;
  color: var(--ink);
  background: rgba(8, 12, 18, 0.96);
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.42);

  &[hidden] {
    display: none;
  }
}

.compact-model-option {
  min-width: 0;
  height: 28px;
  display: grid;
  grid-template-columns: 56px minmax(0, 1fr);
  align-items: center;
  gap: 7px;
  padding: 0 8px;
  border-radius: 6px;
  color: #dce8ec;
  background: transparent;
  text-align: left;

  &:hover,
  &.is-active {
    color: var(--accent);
    background: rgba(67, 240, 206, 0.11);
  }

  span,
  strong {
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  span {
    color: var(--muted);
    font-size: 10px;
    font-weight: 800;
  }

  strong {
    font-size: 11px;
    font-weight: 750;
  }
}

.compact-model-empty {
  padding: 8px;
  color: var(--muted);
  font-size: 12px;
  line-height: 17px;
}

.compact-answer {
  position: absolute;
  left: 0;
  right: 0;
  top: 77px;
  bottom: 0;
  min-height: 0;
  overflow-y: auto;
  padding: 9px 10px;
  border: 1px solid rgba(157, 178, 194, 0.2);
  border-radius: 8px;
  color: #dce8ec;
  background: rgba(3, 7, 12, 0.46);
  font-size: 12px;
  line-height: 17px;
  white-space: pre-wrap;
  word-break: break-word;
  backdrop-filter: none;
  user-select: text;

  &.is-pending {
    color: #91a0ad;
  }
}

.compact-shell {
  &.is-light {
    .brand-copy i,
    .context-meta span,
    .status-dot {
      background: var(--accent);
      box-shadow: 0 0 12px rgba(214, 63, 99, 0.52);
    }

    .status-dot {
      border-color: #f3efe5;
    }

    .agent-icon {
      color: #fff8f4;
      border-color: rgba(214, 63, 99, 0.36);
      background:
        linear-gradient(135deg, rgba(255, 255, 255, 0.72), transparent 34%),
        radial-gradient(circle at 48% 58%, rgba(20, 121, 111, 0.18), transparent 42%),
        linear-gradient(145deg, #fff4ea 0%, #e7eee5 52%, #d2dfdf 100%);
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.64),
        inset 0 -12px 20px rgba(49, 44, 35, 0.12),
        0 14px 28px rgba(52, 45, 35, 0.23),
        0 0 24px rgba(214, 63, 99, 0.12);

      &::before {
        border-color: rgba(45, 49, 44, 0.1);
        background: rgba(255, 255, 255, 0.28);
      }

      &:hover {
        border-color: rgba(214, 63, 99, 0.6);
        box-shadow:
          inset 0 1px 0 rgba(255, 255, 255, 0.72),
          0 16px 30px rgba(52, 45, 35, 0.26),
          0 0 24px rgba(214, 63, 99, 0.18);
      }
    }

    .agent-mark {
      filter: drop-shadow(0 0 8px rgba(214, 63, 99, 0.25));
    }

    .agent-mark,
    .brand-mark {
      .pixel-frame {
        fill: rgba(23, 33, 31, 0.9);
      }

      .pixel-core {
        fill: var(--accent);
      }

      .pixel-soft {
        fill: rgba(20, 121, 111, 0.18);
      }
    }

    #compactPromptInput,
    .field input,
    textarea {
      border-color: rgba(54, 59, 52, 0.16);
      color: var(--ink);
      background: linear-gradient(180deg, rgba(255, 253, 247, 0.92), rgba(244, 247, 243, 0.86));
      box-shadow: inset 0 1px 1px rgba(43, 39, 32, 0.04);

      &:focus {
        border-color: rgba(214, 63, 99, 0.52);
        background: rgba(255, 252, 246, 0.96);
        box-shadow: 0 0 0 3px rgba(214, 63, 99, 0.11), inset 0 1px 1px rgba(43, 39, 32, 0.04);
      }
    }

    .icon-button,
    .field-icon-button,
    .mini-button,
    .toolbar-command,
    .compact-action,
    .ghost-button {
      color: #596662;
      border-color: rgba(54, 59, 52, 0.15);
      background: rgba(250, 248, 240, 0.74);
    }

    .icon-button:hover,
    .icon-button.is-active:hover,
    .field-icon-button:hover:not(:disabled),
    .model-combo.is-open .field-icon-button,
    .mini-button:hover:not(:disabled),
    .toolbar-command:hover:not(:disabled),
    .compact-action:hover,
    .compact-action.is-active,
    .ghost-button:hover {
      color: var(--accent);
      border-color: rgba(214, 63, 99, 0.28);
      background: rgba(255, 232, 224, 0.72);
    }

    .command-button.primary,
    .compact-send {
      border-color: rgba(214, 63, 99, 0.34);
      color: #fffaf7;
      background: linear-gradient(180deg, #f06b88, #d63f63);
      box-shadow: 0 11px 22px rgba(214, 63, 99, 0.2);

      &:hover:not(:disabled) {
        background: linear-gradient(180deg, #ff7d99, #df496b);
      }
    }

    .compact-context,
    .compact-answer,
    .result-box,
    .history-empty,
    .history-item,
    .attachment,
    .attachment-empty {
      border-color: rgba(54, 59, 52, 0.14);
      color: #22302d;
      background: rgba(248, 247, 240, 0.72);
    }

    .compact-context {
      color: #65716c;
    }

    .compact-answer,
    .result-box {
      background: rgba(251, 249, 242, 0.76);
    }

    .compact-answer.is-pending,
    .result-placeholder,
    .preview-empty,
    .history-empty,
    .attachment-empty {
      color: #8a938c;
    }

    .model-menu,
    .compact-model-panel {
      border-color: rgba(54, 59, 52, 0.18);
      color: var(--ink);
      background: rgba(255, 251, 242, 0.97);
      box-shadow: 0 18px 40px rgba(52, 45, 35, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.78);
    }

    .model-option,
    .compact-model-option {
      color: #22302d;
    }

    .model-option:hover,
    .compact-model-option:hover,
    .compact-model-option.is-active {
      color: #8f203d;
      background: rgba(255, 232, 224, 0.78);
    }

    .compact-model-option span,
    .model-empty,
    .compact-model-empty {
      color: #758079;
    }

    .compact-action::after {
      border-color: rgba(54, 59, 52, 0.14);
      color: #18221f;
      background: rgba(255, 251, 242, 0.96);
      box-shadow: 0 10px 24px rgba(52, 45, 35, 0.16);
    }
  }
}

.compact-answer-text {
  white-space: pre-wrap;
  word-break: break-word;
}

.compact-generated-image {
  display: block;
  width: 100%;
  max-height: 180px;
  margin-top: 10px;
  object-fit: contain;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(4, 7, 11, 0.48);
  box-shadow: 0 14px 30px rgba(0, 0, 0, 0.28);
}

#compactMicButton {
  &.is-awake {
    color: #ffd6df;
    border-color: rgba(255, 92, 130, 0.48);
    background: rgba(255, 92, 130, 0.16);
    box-shadow: 0 0 0 1px rgba(255, 92, 130, 0.16), 0 0 20px rgba(255, 92, 130, 0.22);
  }

  &.is-processing svg,
  &.is-recording:not(.is-awake) svg {
    animation: soft-breathe 2.4s ease-in-out infinite;
  }
}

.is-loading svg,
.is-processing svg,
.is-recording svg,
.compact-send.is-loading svg,
.command-button.is-loading svg,
.field-icon-button.is-loading svg,
.mini-button.is-loading svg,
.compact-action.is-loading svg {
  animation: soft-breathe 2.4s ease-in-out infinite;
}

.compact-topline,
.compact-topline[hidden],
.compact-context[hidden],
.main-history-panel[hidden] {
  display: none !important;
}

.compact-history-button,
.answer-expand-button {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(157, 178, 194, 0.16);
  border-radius: 9px;
  color: #aebdcc;
  background: rgba(255, 255, 255, 0.045);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
  transition: color 120ms ease, border-color 120ms ease, background 120ms ease, transform 120ms var(--ease-snap);

  &:hover,
  &.is-active {
    color: var(--accent);
    border-color: rgba(67, 240, 206, 0.34);
    background: rgba(67, 240, 206, 0.1);
    transform: translateY(-1px);
  }

  svg {
    width: 15px;
    height: 15px;
  }
}

.compact-history-panel {
  position: absolute;
  top: 42px;
  right: 0;
  z-index: 42;
  width: min(360px, 100%);
  height: 174px;
  max-height: calc(100% - 42px);
  display: flex;
  padding: 10px;
  overflow: hidden;
  border: 1px solid rgba(157, 178, 194, 0.18);
  border-radius: 12px;
  background: rgba(8, 12, 18, 0.96);
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.36), inset 0 1px 0 rgba(255, 255, 255, 0.08);

  &[hidden] {
    display: none !important;
  }

  :deep(.panel-row) {
    margin-bottom: 8px;
  }

  :deep(.panel-row h2) {
    font-size: 12px;
  }

  :deep(.ghost-button) {
    height: 26px;
    padding: 0 8px;
  }

  :deep(.history-panel) {
    height: 100%;
    padding: 0;
    border: 0;
    background: transparent;
    box-shadow: none;
  }

  :deep(.history-list) {
    min-height: 0;
    max-height: none;
    padding-right: 2px;
    overflow: auto;
  }

  :deep(.history-item),
  :deep(.history-empty) {
    padding: 8px;
  }

  :deep(.history-head strong) {
    font-size: 11px;
  }
}

.compact-screenshot-strip {
  position: absolute;
  left: 0;
  right: 42px;
  top: 42px;
  z-index: 18;
  height: 34px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 34px;
  gap: 6px;

  &[hidden] {
    display: none !important;
  }
}

.compact-screenshot-thumb,
.compact-screenshot-delete {
  height: 34px;
  border: 1px solid rgba(157, 178, 194, 0.16);
  border-radius: 8px;
  color: #aebdcc;
  background: rgba(8, 12, 18, 0.74);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.compact-screenshot-thumb {
  min-width: 0;
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr);
  align-items: center;
  gap: 7px;
  padding: 4px 8px 4px 4px;
  overflow: hidden;
  text-align: left;

  &:hover,
  &.is-active {
    color: var(--accent);
    border-color: rgba(67, 240, 206, 0.34);
    background: rgba(67, 240, 206, 0.1);
  }

  img {
    width: 42px;
    height: 24px;
    object-fit: cover;
    border-radius: 5px;
    background: rgba(255, 255, 255, 0.06);
  }

  span {
    min-width: 0;
    overflow: hidden;
    font-size: 11px;
    font-weight: 800;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
}

.compact-screenshot-delete {
  display: grid;
  place-items: center;
  color: var(--danger);

  &:hover {
    color: var(--accent);
    border-color: rgba(67, 240, 206, 0.34);
    background: rgba(67, 240, 206, 0.1);
  }

  svg {
    width: 14px;
    height: 14px;
  }
}

.compact-screenshot-preview {
  position: absolute;
  left: 0;
  right: 0;
  top: 42px;
  bottom: 0;
  z-index: 74;
  min-height: 0;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 8px;
  overflow: hidden;
  padding: 8px;
  border: 1px solid rgba(157, 178, 194, 0.22);
  border-radius: 12px;
  color: var(--ink);
  background: rgba(8, 12, 18, 0.98);
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.42), inset 0 1px 0 rgba(255, 255, 255, 0.08);

  &[hidden] {
    display: none !important;
  }

  img {
    width: 100%;
    height: 100%;
    min-height: 0;
    object-fit: contain;
    border: 1px solid rgba(157, 178, 194, 0.14);
    border-radius: 8px;
    background:
      linear-gradient(45deg, rgba(255, 255, 255, 0.055) 25%, transparent 25%),
      linear-gradient(-45deg, rgba(255, 255, 255, 0.055) 25%, transparent 25%),
      rgba(3, 7, 12, 0.52);
    background-size: 14px 14px;
  }
}

.compact-screenshot-preview-bar {
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;

  strong {
    min-width: 0;
    overflow: hidden;
    font-size: 12px;
    font-weight: 800;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  > div {
    display: inline-flex;
    gap: 6px;
  }
}

.compact-answer {
  top: 42px;
  padding-right: 40px;
}

.compact-shell {
  &.is-answer-zoomed {
    display: block;
    padding: 0;
    overflow: hidden;
    border: 1px solid rgba(157, 178, 194, 0.2);
    border-radius: 18px;
    background:
      radial-gradient(circle at 18% 0%, rgba(255, 77, 122, 0.16), transparent 32%),
      linear-gradient(180deg, rgba(17, 22, 30, 0.98), rgba(6, 9, 13, 0.98));
    box-shadow: var(--shadow-window);
    clip-path: inset(0 round 18px);

    .compact-agent-zone,
    .compact-orbit,
    .compact-input-row,
    .compact-screenshot-strip,
    .compact-model-panel,
    .compact-history-panel {
      display: none !important;
    }

    .compact-tools {
      position: absolute;
      inset: 0;
      display: block;
    }

    .compact-answer {
      position: absolute;
      inset: 0;
      max-height: none;
      padding: 52px 24px 24px;
      border: 0;
      border-radius: 18px;
      color: var(--ink);
      background: rgba(10, 14, 20, 0.74);
      font-size: 14px;
      line-height: 1.65;
    }

    .compact-screenshot-preview {
      inset: 0;
      border: 0;
      border-radius: 18px;
    }

    .answer-expand-button {
      top: 12px;
      right: 12px;
      width: 34px;
      height: 34px;
      border-radius: 10px;

      .expand-icon {
        display: none;
      }

      .restore-icon {
        display: block;
      }
    }
  }

  &.is-light {
    .compact-generated-image {
      border-color: rgba(54, 59, 52, 0.15);
      background: rgba(255, 250, 242, 0.7);
      box-shadow: 0 14px 28px rgba(52, 45, 35, 0.15);
    }

    #compactMicButton.is-awake {
      color: #8f203d;
      border-color: rgba(214, 63, 99, 0.42);
      background: rgba(255, 232, 224, 0.76);
      box-shadow: 0 0 0 1px rgba(214, 63, 99, 0.12), 0 0 18px rgba(214, 63, 99, 0.18);
    }

    .compact-history-button,
    .answer-expand-button {
      color: #596662;
      border-color: rgba(54, 59, 52, 0.15);
      background: rgba(250, 248, 240, 0.74);

      &:hover,
      &.is-active {
        color: var(--accent);
        border-color: rgba(214, 63, 99, 0.28);
        background: rgba(255, 232, 224, 0.72);
      }
    }

    .compact-history-panel {
      border-color: rgba(54, 59, 52, 0.18);
      color: var(--ink);
      background: rgba(255, 251, 242, 0.97);
      box-shadow: 0 18px 40px rgba(52, 45, 35, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.78);
    }

    .compact-screenshot-thumb,
    .compact-screenshot-delete {
      color: #596662;
      border-color: rgba(54, 59, 52, 0.15);
      background: rgba(250, 248, 240, 0.78);

      &:hover {
        color: var(--accent);
        border-color: rgba(214, 63, 99, 0.28);
        background: rgba(255, 232, 224, 0.72);
      }
    }

    .compact-screenshot-thumb.is-active {
      color: var(--accent);
      border-color: rgba(214, 63, 99, 0.28);
      background: rgba(255, 232, 224, 0.72);
    }

    .compact-screenshot-preview {
      border-color: rgba(54, 59, 52, 0.18);
      color: var(--ink);
      background: rgba(255, 251, 242, 0.98);
      box-shadow: 0 18px 40px rgba(52, 45, 35, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.78);

      img {
        border-color: rgba(54, 59, 52, 0.14);
        background:
          linear-gradient(45deg, rgba(214, 63, 99, 0.045) 25%, transparent 25%),
          linear-gradient(-45deg, rgba(20, 121, 111, 0.045) 25%, transparent 25%),
          #eef1ea;
        background-size: 14px 14px;
      }
    }

    &.is-answer-zoomed {
      border-color: rgba(63, 57, 48, 0.18);
      background:
        radial-gradient(circle at 18% 0%, rgba(214, 63, 99, 0.14), transparent 32%),
        linear-gradient(180deg, rgba(255, 250, 239, 0.98), rgba(230, 238, 235, 0.98));

      .compact-answer {
        color: var(--ink);
        background: rgba(251, 249, 242, 0.82);
      }
    }
  }
}
</style>
