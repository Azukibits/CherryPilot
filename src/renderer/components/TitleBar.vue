<script setup lang="ts">
import CherryMark from './CherryMark.vue';
</script>

<template>
  <header class="titlebar">
    <div class="window-brand">
      <svg class="brand-mark" viewBox="0 0 48 48" aria-hidden="true">
        <CherryMark />
      </svg>
      <div class="brand-copy">
        <strong>CherryPilot</strong>
        <span><i></i> Settings</span>
      </div>
    </div>
    <div class="window-actions">
      <button class="icon-button" id="collapseButton" title="收起为图标" aria-label="收起为图标">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8 3H3v5M16 21h5v-5M3 3l7 7M21 21l-7-7" />
        </svg>
      </button>
      <button class="icon-button is-active" id="pinButton" title="置顶" aria-label="置顶">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 17v5M5 4l5 5M19 4l-5 5M7 9h10l1 6H6z" />
        </svg>
      </button>
      <button class="icon-button" id="minimizeButton" title="最小化" aria-label="最小化">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 12h14" />
        </svg>
      </button>
      <button class="icon-button danger" id="closeButton" title="关闭" aria-label="关闭">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>
    </div>
  </header>
</template>
