<script setup lang="ts">
import { computed, ref } from 'vue';
import { companionState, type HistoryEntry } from '@/renderer/composables/companionState';
import { clearHistory, formatTime, historyMetaText } from '@/renderer/composables/useHistory';
import { formatText, textFor } from '@/renderer/composables/companionText';

const props = defineProps<{
  compact?: boolean;
}>();

// 由父组件决定如何把历史答案打开到回答区或放大阅读。
const emit = defineEmits<{
  openAnswer: [item: HistoryEntry, zoom: boolean];
}>();

// 历史面板使用共享历史记录状态。
const state = companionState;
// 当前选中的历史记录 id，空值表示显示列表。
const selectedId = ref('');
// 当前历史详情项，随 selectedId 自动计算。
const selectedItem = computed(() => state.history.find((item) => item.id === selectedId.value));

// 当前语言文本读取器。
const t = (key: Parameters<typeof textFor>[1]) => textFor(state.guideLanguage, key);
// 当前语言格式化文本读取器。
const ft = (key: Parameters<typeof formatText>[1], values: Record<string, unknown> = {}) => (
  formatText(state.guideLanguage, key, values)
);

// 进入某条历史记录的详情视图。
function selectItem(item: HistoryEntry) {
  selectedId.value = item.id;
}

// 从详情视图回到历史列表。
function backToList() {
  selectedId.value = '';
}

// 清空历史前先清掉当前选择，避免残留详情态。
function clearAll() {
  selectedId.value = '';
  clearHistory();
}

// 详情页底部的时间、模型和上下文标签。
function detailMeta(item: HistoryEntry) {
  const chips = [formatTime(item.askedAt)];
  if (item.model) {
    chips.push(item.model);
  }
  if (item.hasImage) {
    chips.push(t('screenshotChip'));
  }
  if (item.attachmentCount) {
    chips.push(ft('fileCount', { count: item.attachmentCount }));
  }

  return chips.filter(Boolean).join(' · ');
}
</script>

<template>
  <section class="history-panel panel" :class="{ 'is-light': state.theme === 'light', 'is-compact': props.compact }">
    <div class="panel-row">
      <h2>{{ t('history') }}</h2>
      <button
        class="ghost-button"
        type="button"
        :title="t('clear')"
        :aria-label="t('clear')"
        :disabled="state.history.length === 0"
        @click="clearAll"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 6h18M8 6V4h8v2M7 6l1 15h8l1-15" />
        </svg>
        <span>{{ t('clear') }}</span>
      </button>
    </div>

    <div class="history-list">
      <div v-if="state.history.length === 0" class="history-empty">
        {{ t('historyEmpty') }}
      </div>

      <div v-else-if="selectedItem" class="history-detail">
        <div class="history-detail-head">
          <button
            class="history-icon-button"
            type="button"
            :title="t('historyBack')"
            :aria-label="t('historyBack')"
            @click="backToList"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <strong>{{ selectedItem.question || t('historyQuestion') }}</strong>
          <button
            class="history-icon-button"
            type="button"
            :title="t('historyExpand')"
            :aria-label="t('historyExpand')"
            @click="emit('openAnswer', selectedItem, true)"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M8 3H3v5M16 21h5v-5M3 3l7 7M21 21l-7-7" />
            </svg>
          </button>
        </div>

        <div class="history-detail-answer">
          {{ selectedItem.answer || t('noAnswer') }}
        </div>
        <small>{{ detailMeta(selectedItem) }}</small>
      </div>

      <template v-else>
        <button
          v-for="item in state.history"
          :key="item.id"
          class="history-item"
          type="button"
          @click="selectItem(item)"
          @dblclick="emit('openAnswer', item, false)"
        >
          <div class="history-head">
            <strong>{{ item.question || t('contextAnalysis') }}</strong>
            <span>{{ formatTime(item.askedAt) }}</span>
          </div>
          <small>{{ historyMetaText(item) }}</small>
          <p>{{ item.answer || '' }}</p>
        </button>
      </template>
    </div>
  </section>
</template>


<style scoped lang="less">
.history-panel {
  min-height: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.ghost-button {
  height: 25px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 0 8px;
  border: 1px solid var(--line);
  border-radius: 7px;
  color: #a9b7c3;
  background: rgba(255, 255, 255, 0.045);
  font-size: 12px;
  -webkit-app-region: no-drag;
}

.ghost-button svg {
  width: 13px;
  height: 13px;
}

.ghost-button:hover {
  color: var(--accent);
  border-color: rgba(67, 240, 206, 0.3);
  background: rgba(67, 240, 206, 0.09);
}

.history-list {
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 9px;
  overflow: auto;
}

.history-empty {
  min-height: 126px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(157, 178, 194, 0.12);
  border-radius: 8px;
  color: var(--faint);
  font-size: 12px;
  background: rgba(255, 255, 255, 0.025);
}

.history-item {
  min-width: 0;
  flex: 0 0 auto;
  display: grid;
  gap: 6px;
  padding: 10px;
  border: 1px solid rgba(157, 178, 194, 0.14);
  border-radius: 8px;
  color: inherit;
  background: rgba(255, 255, 255, 0.035);
  text-align: left;
}

.history-item:hover {
  border-color: rgba(67, 240, 206, 0.32);
  background: rgba(67, 240, 206, 0.075);
}

.history-head {
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
}

.history-head strong {
  min-width: 0;
  overflow: hidden;
  color: #eef5f6;
  font-size: 12px;
  font-weight: 780;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.history-head span,
.history-item small {
  color: var(--muted);
  font-size: 10px;
}

.history-item p {
  max-height: 52px;
  margin: 0;
  overflow: hidden;
  color: #cbd8de;
  font-size: 12px;
  line-height: 17px;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  word-break: break-word;
}

.history-panel.is-light{
  background: linear-gradient(180deg, rgba(249, 252, 247, 0.96), rgba(229, 239, 240, 0.9));
}

.history-panel.is-light .history-item{
  background: linear-gradient(180deg, rgba(255, 252, 245, 0.82), rgba(240, 246, 242, 0.76));
}

.history-panel.is-light .history-item:hover{
  border-color: rgba(214, 63, 99, 0.26);
  background: linear-gradient(180deg, rgba(255, 242, 235, 0.92), rgba(235, 246, 242, 0.86));
}

.history-panel.is-light .history-head span,
.history-panel.is-light .history-item small,
.history-panel.is-light .attachment-body span,
.history-panel.is-light .context-meta{
  color: #68746e;
}

.history-panel.is-light .history-item p{
  color: #43504c;
}

.history-detail {
  min-width: 0;
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.history-detail-head {
  min-width: 0;
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) 28px;
  align-items: center;
  gap: 6px;
}

.history-detail-head strong {
  min-width: 0;
  overflow: hidden;
  color: var(--ink);
  font-size: 11px;
  font-weight: 800;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.history-icon-button {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(157, 178, 194, 0.16);
  border-radius: 8px;
  color: #aebdcc;
  background: rgba(255, 255, 255, 0.045);
}

.history-icon-button:hover {
  color: var(--accent);
  border-color: rgba(67, 240, 206, 0.34);
  background: rgba(67, 240, 206, 0.1);
}

.history-icon-button svg {
  width: 14px;
  height: 14px;
}

.history-detail-answer {
  min-height: 0;
  flex: 1;
  max-height: none;
  overflow: auto;
  padding: 8px;
  border: 1px solid rgba(157, 178, 194, 0.14);
  border-radius: 8px;
  color: #dce8ec;
  background: rgba(3, 7, 12, 0.38);
  font-size: 12px;
  line-height: 17px;
  white-space: pre-wrap;
  word-break: break-word;
  user-select: text;
}

.history-detail small {
  min-width: 0;
  overflow: hidden;
  color: var(--muted);
  font-size: 10px;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.history-panel.is-light .history-icon-button{
  color: #596662;
  border-color: rgba(54, 59, 52, 0.15);
  background: rgba(250, 248, 240, 0.74);
}

.history-panel.is-light .history-icon-button:hover{
  color: var(--accent);
  border-color: rgba(214, 63, 99, 0.28);
  background: rgba(255, 232, 224, 0.72);
}

.history-panel.is-light .history-detail-answer{
  border-color: rgba(54, 59, 52, 0.14);
  color: #22302d;
  background: rgba(248, 247, 240, 0.72);
}
</style>
