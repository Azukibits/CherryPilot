import { companionState, setBusy, setCompactAnswer, setStatusText } from '@/renderer/composables/companionState';
import { errorMessage } from '@/renderer/composables/errorMessage';
import { formatText, textFor } from '@/renderer/composables/companionText';
import { buildSettingsPayload } from '@/renderer/composables/settingsPayload';
import { getPreparedAttachments } from '@/renderer/composables/useContextSources';
import { addHistory } from '@/renderer/composables/useHistory';

// 当前语言的普通文案读取器。
const t = (key: Parameters<typeof textFor>[1]) => textFor(companionState.guideLanguage, key);
// 当前语言的带参数文案格式化工具。
const ft = (key: Parameters<typeof formatText>[1], values: Record<string, unknown> = {}) => (
  formatText(companionState.guideLanguage, key, values)
);

// 发起一次上下文分析请求，负责保存设置、组装截图/附件并写入历史记录。
export async function runAssistantRequest(
  question: string,
  options: { clearInput?: boolean; pendingText?: string } = {}
) {
  const trimmedQuestion = String(question || '').trim();
  const attachments = getPreparedAttachments();

  if (!trimmedQuestion && !companionState.screenshotDataUrl && attachments.length === 0) {
    setCompactAnswer(t('needPromptOrContext'));
    return false;
  }

  setBusy(true);
  setCompactAnswer(options.pendingText || t('thinking'), true);

  try {
    await window.companion.saveSettings(buildSettingsPayload());

    const result = await window.companion.analyzeContext({
      imageDataUrl: companionState.screenshotDataUrl,
      activeTitle: companionState.activeContext.checkedAt ? companionState.activeContext.title : '',
      note: trimmedQuestion,
      attachments
    });

    setCompactAnswer(result.content);
    addHistory({
      question: trimmedQuestion || t('contextAnalysis'),
      answer: result.content,
      model: result.model,
      hasImage: Boolean(companionState.screenshotDataUrl),
      attachmentCount: attachments.length
    });

    if (options.clearInput !== false) {
      companionState.compactPrompt = '';
    }

    setStatusText(ft('usingModel', { model: result.model }));
    return true;
  } catch (error: unknown) {
    setCompactAnswer(errorMessage(error, t('analysisFailed')));
    return false;
  } finally {
    setBusy(false);
  }
}

// 使用悬浮输入框内容发起提问。
export async function askFromCompact() {
  await runAssistantRequest(companionState.compactPrompt, { clearInput: true });
}

// 发起生图请求，并把生成结果写入回答区和历史记录。
export async function runImageRequest(prompt: string) {
  const imagePrompt = String(prompt || '').trim();

  if (!imagePrompt) {
    setCompactAnswer(t('imagePromptNeeded'), true);
    return false;
  }

  setBusy(true);
  companionState.voiceProcessing = true;
  setCompactAnswer(t('imageGenerating'), true);

  try {
    await window.companion.saveSettings(buildSettingsPayload());
    const result = await window.companion.generateImage({ prompt: imagePrompt });
    const answer = ft('imageGenerated', { prompt: imagePrompt });

    setCompactAnswer(answer, false, result.imageDataUrl);
    addHistory({
      question: `生图：${imagePrompt}`,
      answer,
      imageUrl: result.imageDataUrl,
      model: result.model,
      hasImage: false,
      attachmentCount: 0
    });
    setStatusText(ft('usingModel', { model: result.model }));
    return true;
  } catch (error: unknown) {
    setCompactAnswer(errorMessage(error, t('imageFailed')));
    return false;
  } finally {
    companionState.voiceProcessing = false;
    setBusy(false);
  }
}
