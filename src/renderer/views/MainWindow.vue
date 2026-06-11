<script setup lang="ts">
import SettingsPanel from '@/renderer/components/SettingsPanel.vue';
import TitleBar from '@/renderer/components/TitleBar.vue';
import { companionState } from '@/renderer/composables/companionState';

const state = companionState;
</script>

<template>
  <div class="app-shell" :class="{ 'is-light': state.theme === 'light', 'is-dragging': state.dragging }">
    <TitleBar />

    <main class="workspace settings-workspace">
      <SettingsPanel />
    </main>
  </div>
</template>


<style scoped lang="less">
.app-shell {
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid rgba(157, 178, 194, 0.18);
  border-radius: 8px;
  background:
    linear-gradient(180deg, rgba(16, 22, 31, 0.98), rgba(7, 9, 13, 0.98)),
    var(--bg);
  box-shadow: var(--shadow-window);
  backdrop-filter: none;
  contain: layout paint;
}

.workspace {
  min-height: 0;
  flex: 1;
  display: grid;
  grid-template-rows: auto auto minmax(190px, 0.92fr) minmax(168px, 1fr);
  gap: 9px;
  padding: 9px;
  height: 100%;
  overflow: hidden;
}

.settings-workspace {
  grid-template-rows: minmax(0, 1fr);
}

.app-shell.is-dragging {
  border-color: rgba(67, 240, 206, 0.58);
  box-shadow:
    var(--shadow-window),
    0 0 34px rgba(67, 240, 206, 0.2);
}

.app-shell.is-light {
  border-color: rgba(63, 57, 48, 0.18);
  background:
    linear-gradient(90deg, rgba(214, 63, 99, 0.1), transparent 18%, transparent 82%, rgba(20, 121, 111, 0.11)),
    linear-gradient(180deg, #f1eee4 0%, #e8ebe3 52%, #dce6e3 100%),
    var(--bg);
  box-shadow: var(--shadow-window);
}

.app-shell.is-light :deep(.panel),
.app-shell.is-light :deep(.context-panel) {
  border-color: rgba(58, 59, 51, 0.14);
  background: linear-gradient(180deg, var(--panel-strong), rgba(236, 243, 238, 0.9));
  box-shadow: var(--shadow-soft), inset 0 1px 0 rgba(255, 255, 255, 0.86);
}

.app-shell.is-light :deep(.panel-row h2),
.app-shell.is-light :deep(.active-title),
.app-shell.is-light :deep(.history-head strong),
.app-shell.is-light :deep(.attachment-body strong) {
  color: var(--ink);
}

.app-shell.is-light :deep(.field),
.app-shell.is-light :deep(.status-text),
.app-shell.is-light :deep(.inline-status),
.app-shell.is-light :deep(.toolbar-command),
.app-shell.is-light :deep(.ghost-button) {
  color: #66706c;
}

.settings-workspace :deep(.settings-panel) {
  height: 100%;
  overflow: auto;
}
@media (max-height: 680px) {
  .workspace {
    grid-template-rows: auto auto minmax(158px, 0.8fr) minmax(142px, 0.9fr);
    gap: 7px;
    padding: 7px;
  }

  .settings-workspace {
    grid-template-rows: minmax(0, 1fr);
  }

  .context-panel,
  .panel {
    padding: 8px;
  }

  .field:first-of-type {
    margin-top: 6px;
    margin-bottom: 6px;
  }

  .preview-frame {
    min-height: 100px;
  }

  textarea {
    flex-basis: 44px;
    min-height: 44px;
  }
}
</style>
