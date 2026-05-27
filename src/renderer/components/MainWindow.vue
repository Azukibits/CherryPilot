<script setup lang="ts">
import SettingsPanel from './SettingsPanel.vue';
import TitleBar from './TitleBar.vue';
</script>

<template>
  <div class="app-shell">
    <TitleBar />

    <main class="workspace settings-workspace">
      <SettingsPanel />

      <section class="history-panel panel main-history-panel" hidden>
        <div class="panel-row">
          <h2>历史询问</h2>
          <button class="ghost-button" id="clearHistoryButton" title="清空历史">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 6h18M8 6V4h8v2M7 6l1 15h8l1-15" />
            </svg>
            <span>清空</span>
          </button>
        </div>
        <div class="history-list" id="historyList"></div>
      </section>
    </main>
  </div>
</template>
