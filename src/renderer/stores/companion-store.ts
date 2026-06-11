import { defineStore } from 'pinia';
import { reactive, toRefs } from 'vue';
import { textFor } from '@/renderer/composables/companionText';
import { pinia } from '@/renderer/stores/pinia';
import { createCompanionState } from '@/renderer/stores/companion-state';

/**
 * Companion 的 Pinia 绑定层。
 * 这里仅维护跨组件共享的状态和最基础的写入方法，复杂业务留在 composables。
 */
export const useCompanionStore = defineStore('companion', () => {
  const state = reactive(createCompanionState());

  /**
   * 全局忙碌状态，用于禁用按钮和展示处理中反馈。
   */
  function setBusy(value: boolean) {
    state.isBusy = value;
  }

  /**
   * 底部状态文案统一入口，避免组件各自维护临时提示。
   */
  function setStatusText(message: string) {
    state.statusText = message;
  }

  /**
   * 写入紧凑回答区内容。
   * 空内容会回退到当前语言的等待提示，防止面板出现空白态。
   */
  function setCompactAnswer(content: string, pending = false, imageUrl = '') {
    state.answerContent = content || textFor(state.guideLanguage, 'waitingQuestion');
    state.answerPending = pending;
    state.answerImageUrl = imageUrl;
  }

  return {
    ...toRefs(state),
    setBusy,
    setStatusText,
    setCompactAnswer
  };
});

/**
 * 应用级单例 store。
 * 旧代码直接导入 companionState，保留这个出口可以减少调用侧迁移成本。
 */
export const companionState = useCompanionStore(pinia);
