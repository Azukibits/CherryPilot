<script setup lang="ts">
import HistoryPanel from '@/renderer/components/HistoryPanel.vue';
import SettingsPanel from '@/renderer/components/SettingsPanel.vue';
import TitleBar from '@/renderer/components/TitleBar.vue';
</script>

<template>
  <div class="app-shell">
    <TitleBar />

    <main class="workspace settings-workspace">
      <SettingsPanel />
      <HistoryPanel class="main-history-panel" hidden />
    </main>
  </div>
</template>
