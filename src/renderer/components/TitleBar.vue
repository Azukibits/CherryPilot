<script setup lang="ts">
import CherryMark from '@/renderer/components/CherryMark.vue';
import { companionState } from '@/renderer/stores/companion';
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
  <header class="titlebar" :class="{ 'is-light': state.theme === 'light' }">
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


<style scoped lang="less">
.titlebar {
  height: 54px;
  flex: 0 0 54px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 0 10px 0 12px;
  border-bottom: 1px solid var(--line);
  background: rgba(7, 10, 15, 0.76);
  -webkit-app-region: drag;
}

.window-brand {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 9px;
}

.brand-mark {
  width: 34px;
  height: 34px;
  padding: 6px;
  border: 1px solid rgba(255, 77, 122, 0.24);
  border-radius: 8px;
  color: #effffb;
  background: linear-gradient(145deg, rgba(255, 77, 122, 0.18), rgba(56, 215, 135, 0.11));
}

.brand-copy {
  min-width: 0;
  display: grid;
  gap: 2px;
}

.brand-copy strong {
  overflow: hidden;
  color: #f3f9fb;
  font-size: 14px;
  font-weight: 750;
  line-height: 16px;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.brand-copy span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--muted);
  font-size: 11px;
  line-height: 13px;
}

.brand-copy i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 10px rgba(67, 240, 206, 0.8);
}

.window-actions {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  -webkit-app-region: no-drag;
}

.icon-button,
.mini-button,
.field-icon-button {
  display: inline-grid;
  place-items: center;
  color: #99a7b4;
  background: transparent;
  transform: translateZ(0);
  transition: color 120ms ease, border-color 120ms ease, background 120ms ease, transform 120ms var(--ease-snap);
}

.icon-button {
  width: 30px;
  height: 30px;
  border-radius: 7px;
}

.icon-button svg {
  width: 16px;
  height: 16px;
}

.icon-button:hover,
.icon-button.is-active:hover {
  color: var(--ink);
  background: rgba(255, 255, 255, 0.075);
}

.icon-button.is-active {
  color: var(--accent);
}

.icon-button.danger:hover {
  color: #fff;
  background: rgba(255, 96, 120, 0.82);
}

.titlebar.is-light{
  position: relative;
  border-bottom-color: rgba(61, 58, 50, 0.13);
  background:
    linear-gradient(90deg, rgba(255, 248, 235, 0.94), rgba(237, 242, 234, 0.92) 54%, rgba(226, 238, 237, 0.92));
}

.titlebar.is-light::after{
  content: "";
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: -1px;
  height: 1px;
  background: linear-gradient(90deg, rgba(214, 63, 99, 0.78), rgba(20, 121, 111, 0.48), transparent 86%);
  pointer-events: none;
}

.titlebar.is-light .brand-copy strong{
  color: var(--ink);
}

.titlebar.is-light .brand-copy span{
  color: #66706c;
}

.titlebar.is-light .brand-mark{
  color: #24423d;
  border-color: rgba(214, 63, 99, 0.2);
  background:
    linear-gradient(145deg, rgba(255, 240, 230, 0.92), rgba(221, 238, 232, 0.86));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.75), 0 8px 16px rgba(52, 45, 35, 0.1);
}

.titlebar.is-light .icon-button.is-active{
  color: var(--accent);
}

.titlebar.is-light .icon-button.danger:hover{
  color: #fffaf7;
  background: rgba(214, 63, 99, 0.86);
}
</style>
