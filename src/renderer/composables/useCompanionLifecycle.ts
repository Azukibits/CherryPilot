import { onMounted, onUnmounted, watch } from 'vue';
import { UI_TEXT } from '@/renderer/entity';
import { companionState, setCompactAnswer } from '@/renderer/composables/companionState';
import { textFor } from '@/renderer/composables/companionText';
import { ingestFileList, handleLanShareReceived, setScreenshot } from '@/renderer/composables/useContextSources';
import { loadHistory } from '@/renderer/composables/useHistory';
import {
  applyWindowMode,
  clearAutoCompact,
  closeProviderMenus,
  hideExitContextBlock,
  loadContext,
  scheduleAutoCompact
} from '@/renderer/composables/useWindowMode';

// 管理应用级浏览器/Electron 监听；组件局部 UI 事件仍留在各组件内。
export function useCompanionLifecycle() {
  // 同步 html lang，保证日期格式和可访问性语言跟随引导语言。
  const removeDocumentLocaleWatch = watch(
    () => companionState.guideLanguage,
    (language) => {
      document.documentElement.lang = UI_TEXT[language]?.lang || UI_TEXT.zh.lang;
    },
    { immediate: true }
  );

  // 全局点击用于关闭 provider、模型、历史和截图预览等浮层。
  const onDocumentClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement | null;

    if (!target?.closest?.('.model-combo')) {
      closeProviderMenus();
    }

    if (
      companionState.compactModelPanelOpen
      && !target?.closest?.('#compactModelPanel')
      && !target?.closest?.('#compactModelButton')
    ) {
      companionState.compactModelPanelOpen = false;
    }

    if (
      companionState.compactHistoryPanelOpen
      && !target?.closest?.('#compactHistoryPanel')
      && !target?.closest?.('#compactHistoryButton')
    ) {
      companionState.compactHistoryPanelOpen = false;
    }

    if (
      companionState.screenshotPreviewOpen
      && !target?.closest?.('#compactScreenshotPreviewPanel')
      && !target?.closest?.('#compactScreenshotPreviewButton')
    ) {
      companionState.screenshotPreviewOpen = false;
    }
  };

  // 鼠标进入展开态窗口时取消自动收起。
  const onMouseEnter = () => {
    if (companionState.windowMode !== 'expanded') {
      return;
    }

    companionState.pointerInWindow = true;
    clearAutoCompact();
  };

  // 鼠标在展开态窗口移动时持续刷新停留状态。
  const onMouseMove = () => {
    if (companionState.windowMode !== 'expanded') {
      return;
    }

    companionState.pointerInWindow = true;
    clearAutoCompact();
  };

  // 鼠标离开展开态窗口后尝试启动自动收起。
  const onMouseLeave = () => {
    companionState.pointerInWindow = false;
    scheduleAutoCompact();
  };

  // 拖拽进入窗口时显示拖拽态，支持多层 dragenter/dragleave 计数。
  const onDragEnter = (event: DragEvent) => {
    event.preventDefault();
    companionState.dragDepth += 1;
    companionState.dragging = true;
  };

  // 拖拽悬停时声明 copy 行为，避免浏览器默认打开文件。
  const onDragOver = (event: DragEvent) => {
    event.preventDefault();

    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
  };

  // 拖拽离开时递减层级，回到 0 才退出拖拽态。
  const onDragLeave = (event: DragEvent) => {
    event.preventDefault();
    companionState.dragDepth = Math.max(0, companionState.dragDepth - 1);

    if (companionState.dragDepth === 0) {
      companionState.dragging = false;
    }
  };

  // 文件释放到窗口后读取附件并追加到上下文。
  const onDrop = async (event: DragEvent) => {
    event.preventDefault();
    companionState.dragDepth = 0;
    companionState.dragging = false;
    await ingestFileList(event.dataTransfer?.files);
  };

  // 保存主进程事件订阅返回的清理函数，卸载时逐个执行。
  const cleanups: Array<() => void> = [];

  onMounted(() => {
    loadHistory();

    document.addEventListener('click', onDocumentClick);
    document.addEventListener('pointerdown', hideExitContextBlock, { capture: true });
    document.addEventListener('mouseenter', onMouseEnter);
    document.addEventListener('mousemove', onMouseMove, { passive: true });
    document.addEventListener('mouseleave', onMouseLeave);
    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);

    loadContext().catch(() => null);
    window.companion.getWindowMode().then(applyWindowMode).catch(() => null);

    // 主进程推送外部窗口标题更新。
    const contextCleanup = window.companion.onContextUpdated?.((context: CompanionActiveContext) => {
      companionState.activeContext = context || companionState.activeContext;
    });
    // 主进程推送窗口模式变化，renderer 只同步 UI 状态。
    const modeCleanup = window.companion.onWindowModeChanged?.(applyWindowMode);
    // 主进程完成截图后切到悬浮窗并展开工具区。
    const screenshotCleanup = window.companion.onScreenshotCreated?.(async (payload: CompanionScreenshotPayload) => {
      setScreenshot(payload);
      const modeState = await window.companion.setWindowMode('compact');
      applyWindowMode(modeState);
      await window.companion.revealCompactWindow();
      companionState.revealed = true;
    });
    // 主进程截图失败时把错误展示到悬浮回答区。
    const screenshotErrorCleanup = window.companion.onScreenshotError?.((message: string) => {
      setCompactAnswer(message || textFor(companionState.guideLanguage, 'screenshotFailed'));
    });
    // LAN 分享收到文本或文件时追加为上下文附件。
    const lanCleanup = window.companion.onLanShareReceived?.(handleLanShareReceived);

    for (const cleanup of [
      contextCleanup,
      modeCleanup,
      screenshotCleanup,
      screenshotErrorCleanup,
      lanCleanup
    ]) {
      if (typeof cleanup === 'function') {
        cleanups.push(cleanup);
      }
    }
  });

  // 组件卸载时移除所有全局监听和主进程事件订阅。
  onUnmounted(() => {
    removeDocumentLocaleWatch();
    document.removeEventListener('click', onDocumentClick);
    document.removeEventListener('pointerdown', hideExitContextBlock, { capture: true });
    document.removeEventListener('mouseenter', onMouseEnter);
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseleave', onMouseLeave);
    window.removeEventListener('dragenter', onDragEnter);
    window.removeEventListener('dragover', onDragOver);
    window.removeEventListener('dragleave', onDragLeave);
    window.removeEventListener('drop', onDrop);
    cleanups.forEach((cleanup) => cleanup());
  });
}
