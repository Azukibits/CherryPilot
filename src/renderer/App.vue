<script setup lang="ts">
import { onMounted } from 'vue';
import { bootCompanionRenderer } from './controller';

onMounted(() => {
  bootCompanionRenderer();
});
</script>

<template>
  <span
    hidden
    aria-hidden="true"
  />
</template>
