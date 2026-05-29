import { computed } from 'vue';
import { companionState, setBusy, setCompactAnswer, setStatusText, type AttachmentItem } from '@/renderer/composables/companionState';
import { errorMessage } from '@/renderer/composables/errorMessage';
import { formatText, textFor } from '@/renderer/composables/companionText';
import { applyWindowMode } from '@/renderer/composables/useWindowMode';

// 当前语言的普通文案读取器。
const t = (key: Parameters<typeof textFor>[1]) => textFor(companionState.guideLanguage, key);
// 当前语言的带参数文案格式化工具。
const ft = (key: Parameters<typeof formatText>[1], values: Record<string, unknown> = {}) => (
  formatText(companionState.guideLanguage, key, values)
);

// 汇总当前可用上下文：截图和可分析附件数量。
export const contextStatusText = computed(() => {
  const parts: string[] = [];

  if (companionState.screenshotDataUrl) {
    parts.push(t('screenshot'));
  }

  const validAttachments = companionState.attachments.filter((item) => item.text && !item.error);
  if (validAttachments.length > 0) {
    parts.push(`${validAttachments.length} ${t('file')}`);
  }

  return parts.length > 0 ? parts.join(' / ') : t('noContext');
});

// 关闭悬浮截图预览面板。
export function closeScreenshotPreview() {
  companionState.screenshotPreviewOpen = false;
}

// 打开悬浮截图预览面板，并关闭互斥面板。
export function openScreenshotPreview(event?: Event) {
  event?.preventDefault?.();
  event?.stopPropagation?.();

  if (!companionState.screenshotDataUrl) {
    return;
  }

  companionState.compactModelPanelOpen = false;
  companionState.compactHistoryPanelOpen = false;
  companionState.screenshotPreviewOpen = true;
}

// 清除当前截图上下文。
export function clearScreenshot(event?: Event) {
  event?.preventDefault?.();
  event?.stopPropagation?.();

  if (!companionState.screenshotDataUrl) {
    return;
  }

  companionState.screenshotDataUrl = '';
  closeScreenshotPreview();
  setCompactAnswer(t('screenshotDeleted'));
}

// 请求主进程进入区域截图选择。
export async function selectRegion() {
  setCompactAnswer(t('screenshotSelecting'), true);

  try {
    await window.companion.selectRegion();
  } catch (error: unknown) {
    setCompactAnswer(errorMessage(error, t('screenshotFailed')));
  }
}

// 接收主进程截图结果并更新预览状态。
export function setScreenshot(payload: CompanionScreenshotPayload | null | undefined) {
  companionState.screenshotDataUrl = payload?.dataUrl || '';

  if (!companionState.screenshotDataUrl) {
    closeScreenshotPreview();
    return;
  }

  setCompactAnswer(t('screenshotReady'));
  openScreenshotPreview();
}

// 从浏览器 File 对象中提取真实本地路径，无法提取的文件名单独返回。
function getFilePaths(fileList: File[]) {
  const paths: string[] = [];
  const missing: string[] = [];

  for (const file of fileList) {
    const filePath = window.companion.getPathForFile?.(file);

    if (filePath) {
      paths.push(filePath);
    } else {
      missing.push(file.name);
    }
  }

  return { paths, missing };
}

// 准备发送给 AI 的附件，只保留有文本且没有错误的条目。
export function getPreparedAttachments() {
  return companionState.attachments
    .filter((item) => item.text && !item.error)
    .map((item) => ({
      id: item.id,
      name: item.name,
      type: item.type,
      size: item.size,
      text: item.text
    }));
}

// 原始读取结果保存在共享状态中，真正分析时只发送有文本的附件。
export async function appendIngestedItems(items: AttachmentItem[] = []) {
  companionState.attachments = companionState.attachments.concat(items);

  const successCount = items.filter((item) => !item.error).length;
  const errorCount = items.length - successCount;
  const message = errorCount
    ? ft('filesReadPartial', { success: successCount, failed: errorCount })
    : ft('filesReadReady', { success: successCount });

  setCompactAnswer(message);

  const modeState = await window.companion.setWindowMode('compact');
  applyWindowMode(modeState);
  await window.companion.revealCompactWindow();
  companionState.revealed = true;
}

// 按本地路径读取文件/目录并追加到附件上下文。
export async function ingestPaths(paths: string[] = [], missingNames: string[] = []) {
  if (paths.length === 0) {
    if (missingNames.length > 0) {
      setCompactAnswer(ft('missingFilePath', { names: missingNames.join(', ') }));
    }
    return;
  }

  setBusy(true);
  setCompactAnswer(t('readingFiles'), true);

  try {
    const items = await window.companion.ingestFiles(paths);
    await appendIngestedItems(items);
  } catch (error: unknown) {
    setCompactAnswer(errorMessage(error, t('filesReadFailed')));
  } finally {
    setBusy(false);
  }
}

// 处理拖拽或浏览器文件选择产生的 FileList。
export async function ingestFileList(fileList: FileList | File[] | null | undefined) {
  const files = Array.from(fileList || []);

  if (files.length === 0) {
    return;
  }

  if (typeof window.companion.ingestBrowserFiles === 'function') {
    setBusy(true);
    setCompactAnswer(t('readingFiles'), true);

    try {
      const items = await window.companion.ingestBrowserFiles(files);
      await appendIngestedItems(items);
    } catch (error: unknown) {
      setCompactAnswer(errorMessage(error, t('filesReadFailed')));
    } finally {
      setBusy(false);
    }
    return;
  }

  const { paths, missing } = getFilePaths(files);
  await ingestPaths(paths, missing);
}

// 优先使用主进程原生文件选择，缺失时回退浏览器文件选择。
export async function triggerFilePicker(openBrowserPicker: () => void) {
  if (typeof window.companion.selectAnalysisSources === 'function') {
    try {
      const paths = await window.companion.selectAnalysisSources();
      await ingestPaths(paths || []);
    } catch (error: unknown) {
      setCompactAnswer(errorMessage(error, t('filesReadFailed')));
    }
    return;
  }

  openBrowserPicker();
}

// 接收 LAN 分享推送的附件，并同步到上下文和状态提示。
export function handleLanShareReceived(payload: CompanionLanSharePayload = {}) {
  const items = Array.isArray(payload.items) ? payload.items : [];

  if (items.length === 0) {
    return;
  }

  companionState.attachments = companionState.attachments.concat(items);

  const successCount = items.filter((item: AttachmentItem) => !item.error).length;
  const errorCount = items.length - successCount;
  const message = errorCount
    ? ft('lanReceivedPartial', { success: successCount, failed: errorCount })
    : ft('lanReceived', { success: successCount });

  setCompactAnswer(message);
  setStatusText(message);
}
