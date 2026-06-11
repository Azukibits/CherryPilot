import { companionState } from '@/renderer/stores/companion-store';

/**
 * 共享 action 的函数式出口。
 * 复杂业务不要继续塞到这里，应拆到对应 composable 或独立 store 文件。
 */
export const setBusy = (value: boolean) => companionState.setBusy(value);

/**
 * 设置全局状态文案。
 */
export const setStatusText = (message: string) => companionState.setStatusText(message);

/**
 * 设置紧凑回答区内容、流式等待状态和可选图片结果。
 */
export const setCompactAnswer = (content: string, pending = false, imageUrl = '') => (
  companionState.setCompactAnswer(content, pending, imageUrl)
);
