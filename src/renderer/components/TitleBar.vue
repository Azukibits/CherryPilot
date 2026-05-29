<script setup lang="ts">
import CherryMark from '@/renderer/components/CherryMark.vue';
import { companionState } from '@/renderer/composables/companionState';
import { textFor } from '@/renderer/composables/companionText';
import { collapseToCompact } from '@/renderer/composables/useWindowMode';

// 标题栏读取共享状态，用于同步置顶和语言文案。
const state = companionState;
// 当前语言文本读取器。
const t = (key: Parameters<typeof textFor>[1]) => textFor(state.guideLanguage, key);

// 将主窗口收起为紧凑悬浮图标。
async function collapseWindow() {
  await collapseToCompact();
}

// 切换窗口置顶状态，并同步按钮高亮。
async function togglePin() {
  const pinned = await window.companion.togglePin();
  state.docked = Boolean(pinned);
}

// 最小化主窗口。
function minimizeWindow() {
  window.companion.minimizeWindow();
}

// 关闭主窗口。
function closeWindow() {
  window.companion.closeWindow();
}
</script>

<template>
  <header class="titlebar">
    <div class="window-brand">
      <svg class="brand-mark" viewBox="0 0 48 48" aria-hidden="true">
        <CherryMark />
      </svg>
      <div class="brand-copy">
        <strong>CherryPilot</strong>
        <span><i></i> {{ t('brandMode') }}</span>
      </div>
    </div>

    <div class="window-actions">
      <button
        class="icon-button"
        id="collapseButton"
        type="button"
        :title="t('collapse')"
        :aria-label="t('collapse')"
        @click="collapseWindow"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8 3H3v5M16 21h5v-5M3 3l7 7M21 21l-7-7" />
        </svg>
      </button>
      <button
        class="icon-button"
        :class="{ 'is-active': state.docked }"
        id="pinButton"
        type="button"
        :title="t('pin')"
        :aria-label="t('pin')"
        @click="togglePin"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 17v5M5 4l5 5M19 4l-5 5M7 9h10l1 6H6z" />
        </svg>
      </button>
      <button
        class="icon-button"
        id="minimizeButton"
        type="button"
        :title="t('minimize')"
        :aria-label="t('minimize')"
        @click="minimizeWindow"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 12h14" />
        </svg>
      </button>
      <button
        class="icon-button danger"
        id="closeButton"
        type="button"
        :title="t('close')"
        :aria-label="t('close')"
        @click="closeWindow"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>
    </div>
  </header>
</template>
