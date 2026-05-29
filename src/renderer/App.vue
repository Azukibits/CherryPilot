<script setup lang="ts">
import CompactShell from '@/renderer/components/CompactShell.vue';
import MainWindow from '@/renderer/views/MainWindow.vue';
import { useBodyDatasetSync } from '@/renderer/composables/companionState';
import { useCompanionLifecycle } from '@/renderer/composables/useCompanionLifecycle';

useBodyDatasetSync();
useCompanionLifecycle();
</script>

<template>
  <CompactShell />
  <MainWindow />
</template>
