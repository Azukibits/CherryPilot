<script setup lang="ts">
import { onMounted } from 'vue';
import CompactShell from './components/CompactShell.vue';
import HiddenFileInput from './components/HiddenFileInput.vue';
import MainWindow from './components/MainWindow.vue';
import { bootCompanionRenderer } from './controller';

onMounted(() => {
  bootCompanionRenderer();
});
</script>

<template>
  <CompactShell />
  <MainWindow />
  <HiddenFileInput />
</template>
