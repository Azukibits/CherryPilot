<script setup lang="ts">
import { computed, ref } from 'vue';
import { companionState, type HistoryEntry } from '@/renderer/composables/companionState';
import { clearHistory, formatTime, historyMetaText } from '@/renderer/composables/useHistory';
import { formatText, textFor } from '@/renderer/composables/companionText';

defineProps<{
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
  <section class="history-panel panel">
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
