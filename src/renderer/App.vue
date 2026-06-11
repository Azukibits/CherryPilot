<script setup lang="ts">
import { computed } from 'vue';
import CompactShell from '@/renderer/components/CompactShell.vue';
import MainWindow from '@/renderer/views/MainWindow.vue';
import { companionState } from '@/renderer/stores/companion';
import { useCompanionLifecycle } from '@/renderer/composables/useCompanionLifecycle';

const state = companionState;
const appClasses = computed(() => {
  const compact = state.windowMode === 'compact';

  return {
    'is-theme-light': state.theme === 'light',
    'is-mode-compact': compact,
    'is-dock-left': compact && state.dockSide === 'left',
    'is-revealed': compact && state.revealed,
    'is-concealed': compact && !state.revealed,
    'is-docked': compact && state.docked,
    'is-answer-zoomed': compact && state.answerZoomed,
    'is-busy': state.isBusy,
    'has-screenshot': Boolean(state.screenshotDataUrl),
    'is-dragging': state.dragging,
    'is-context-menu-open': compact && state.contextMenuOpen,
    'is-voice-listening': compact && state.isRecording && !state.voiceAwake,
    'is-voice-awake': compact && state.isRecording && state.voiceAwake
  };
});

useCompanionLifecycle();
</script>

<template>
  <div
    class="app-root"
    :class="appClasses"
  >
    <CompactShell v-show="state.windowMode === 'compact'" />
    <MainWindow v-show="state.windowMode !== 'compact'" />
  </div>
</template>

<style scoped lang="less">
.app-root {
  width: 100%;
  height: 100%;
}
</style>
