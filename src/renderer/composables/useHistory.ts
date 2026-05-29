import { companionState, type HistoryEntry } from '@/renderer/composables/companionState';
import { formatText, UI_TEXT, textFor } from '@/renderer/composables/companionText';
import { HISTORY_KEY } from '@/renderer/entity';

// 按当前语言格式化历史记录时间。
export function formatTime(value?: string) {
  if (!value) {
    return '--';
  }

  return new Intl.DateTimeFormat(UI_TEXT[companionState.guideLanguage].lang, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

// 从 localStorage 读取历史记录，最多保留最近 50 条。
export function loadHistory() {
  try {
    const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    companionState.history = Array.isArray(parsed) ? parsed.slice(0, 50) : [];
  } catch {
    companionState.history = [];
  }
}

// 将历史记录写回 localStorage，避免列表无限增长。
export function saveHistory() {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(companionState.history.slice(0, 50)));
}

// 清空历史记录并同步持久化状态。
export function clearHistory() {
  companionState.history = [];
  saveHistory();
}

// 新增一条问答历史，自动补齐 id 和提问时间。
export function addHistory(entry: Omit<HistoryEntry, 'id' | 'askedAt'>) {
  companionState.history.unshift({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    askedAt: new Date().toISOString(),
    ...entry
  });
  companionState.history = companionState.history.slice(0, 50);
  saveHistory();
}

// 生成历史记录详情里可复制/查看的回答文本。
export function getHistoryAnswerText(item: HistoryEntry) {
  return [
    item.question || textFor(companionState.guideLanguage, 'historyQuestion'),
    '',
    item.answer || ''
  ].join('\n');
}

// 生成历史记录卡片上的模型、截图和附件摘要。
export function historyMetaText(item: HistoryEntry) {
  const chips: string[] = [];

  if (item.hasImage) {
    chips.push(textFor(companionState.guideLanguage, 'screenshotChip'));
  }

  if (item.attachmentCount) {
    chips.push(formatText(companionState.guideLanguage, 'fileCount', { count: item.attachmentCount }));
  }

  if (item.model) {
    chips.push(item.model);
  }

  return chips.join(' · ') || textFor(companionState.guideLanguage, 'textOnly');
}
