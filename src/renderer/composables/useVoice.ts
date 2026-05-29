import {
  VOICE_RESTART_MS,
  VOICE_SEGMENT_MS,
  VOICE_WAKE_PHRASE
} from '@/renderer/entity';
import { companionState, setCompactAnswer } from '@/renderer/composables/companionState';
import { errorMessage } from '@/renderer/composables/errorMessage';
import { formatText, textFor } from '@/renderer/composables/companionText';
import { buildSettingsPayload } from '@/renderer/composables/settingsPayload';
import { runAssistantRequest, runImageRequest } from '@/renderer/composables/useAssistant';

// 当前语言的普通文案读取器。
const t = (key: Parameters<typeof textFor>[1]) => textFor(companionState.guideLanguage, key);
// 当前语言的带参数文案格式化工具。
const ft = (key: Parameters<typeof formatText>[1], values: Record<string, unknown> = {}) => (
  formatText(companionState.guideLanguage, key, values)
);

// 选择当前浏览器支持的优先录音 MIME 类型。
function getPreferredAudioMimeType() {
  if (!window.MediaRecorder) {
    return '';
  }

  return [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4'
  ].find((type) => MediaRecorder.isTypeSupported(type)) || '';
}

// 停止麦克风音轨并释放媒体流。
function stopVoiceTracks() {
  if (companionState.voiceStream) {
    for (const track of companionState.voiceStream.getTracks()) {
      track.stop();
    }
  }

  companionState.voiceStream = null;
}

// 清理语音分段和自动重启定时器。
function clearVoiceTimers() {
  clearTimeout(companionState.voiceSegmentTimer);
  clearTimeout(companionState.voiceRestartTimer);
  companionState.voiceSegmentTimer = null;
  companionState.voiceRestartTimer = null;
}

// 退出语音模式，停止录音器、音轨和相关状态。
export function stopVoiceMode(message = '') {
  clearVoiceTimers();
  companionState.isRecording = false;
  companionState.voiceAwake = false;
  companionState.voiceChunks = [];

  const recorder = companionState.mediaRecorder;
  companionState.mediaRecorder = null;

  if (recorder && recorder.state !== 'inactive') {
    try {
      recorder.stop();
    } catch {
      // 录音器可能已经被分段定时器停止，这里只做兜底吞错。
    }
  }

  stopVoiceTracks();
  companionState.voiceProcessing = false;

  if (message) {
    setCompactAnswer(message);
  }
}

// 在短暂间隔后开始下一段录音，保持持续监听。
function scheduleNextVoiceSegment(delay = VOICE_RESTART_MS) {
  clearTimeout(companionState.voiceRestartTimer);

  if (!companionState.isRecording) {
    return;
  }

  companionState.voiceRestartTimer = setTimeout(() => {
    companionState.voiceRestartTimer = null;
    startVoiceSegment().catch((error: unknown) => {
      stopVoiceMode(errorMessage(error, t('voiceStartFailed')));
    });
  }, delay);
}

// 确保存在可用麦克风流，复用仍然 active 的流。
async function ensureVoiceStream() {
  if (companionState.voiceStream && companionState.voiceStream.active) {
    return companionState.voiceStream;
  }

  companionState.voiceStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    }
  });

  return companionState.voiceStream;
}

// 分段录音能保持唤醒词识别响应，也避免长期持有一个 MediaRecorder。
async function startVoiceSegment() {
  if (!companionState.isRecording) {
    return;
  }

  const stream = await ensureVoiceStream();
  const mimeType = getPreferredAudioMimeType();
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks: Blob[] = [];
  const finalMimeType = recorder.mimeType || mimeType || 'audio/webm';

  companionState.mediaRecorder = recorder;
  companionState.voiceChunks = chunks;
  companionState.voiceMimeType = finalMimeType;

  recorder.addEventListener('dataavailable', (event) => {
    if (event.data && event.data.size > 0) {
      chunks.push(event.data);
    }
  });

  recorder.addEventListener('stop', async () => {
    clearTimeout(companionState.voiceSegmentTimer);
    companionState.voiceSegmentTimer = null;

    if (companionState.mediaRecorder === recorder) {
      companionState.mediaRecorder = null;
    }

    if (companionState.isRecording) {
      await processVoiceSegment(finalMimeType, chunks);
    }

    if (companionState.isRecording) {
      scheduleNextVoiceSegment();
    }
  }, { once: true });

  recorder.start(250);
  companionState.voiceSegmentTimer = setTimeout(() => {
    if (recorder.state !== 'inactive') {
      recorder.stop();
    }
  }, VOICE_SEGMENT_MS);
}

// 把当前录音片段送到主进程转写，并按唤醒状态决定是否执行命令。
async function processVoiceSegment(mimeType: string, chunks: Blob[]) {
  if (!chunks.length) {
    return;
  }

  companionState.voiceProcessing = true;

  try {
    const blob = new Blob(chunks, { type: mimeType });
    const audioBuffer = await blob.arrayBuffer();
    const result = await window.companion.transcribeAudio({ audioBuffer, mimeType });
    const transcript = String(result.text || '').trim();

    if (!transcript) {
      return;
    }

    if (!companionState.voiceAwake) {
      const command = extractWakeCommand(transcript);

      if (command === null) {
        setCompactAnswer(t('waitingWake'), true);
        return;
      }

      companionState.voiceAwake = true;

      if (!command) {
        setCompactAnswer(t('voiceAwake'), true);
        return;
      }

      await handleVoiceCommand(command);
      return;
    }

    await handleVoiceCommand(transcript);
  } catch (error: unknown) {
    const message = errorMessage(error, t('voiceFailed'));

    if (/api key|unauthorized|forbidden|401|403/i.test(message)) {
      stopVoiceMode(message);
      return;
    }

    setCompactAnswer(ft('keepListening', { message }), true);
  } finally {
    companionState.voiceProcessing = false;
  }
}

// 归一化语音识别文本，便于匹配英文和中文命令。
function normalizeVoiceText(text: string) {
  return String(text || '')
    .toLowerCase()
    .replace(/\u55e8|\u563f/g, 'hi')
    .replace(/[.,!?;:"'`~()[\]{}<>_-]+/g, ' ')
    .replace(/[\u3001\u3002\uff0c\uff1f\uff01\uff1a\uff1b]+/g, ' ')
    .replace(/[\u3000\s]+/g, ' ')
    .trim();
}

// 从识别文本中提取唤醒词后面的命令；未唤醒时返回 null。
function extractWakeCommand(text: string) {
  const normalized = normalizeVoiceText(text);
  const variants = [
    VOICE_WAKE_PHRASE,
    'hey cherry',
    'hi cherry pilot',
    'hi cherrypilot'
  ];

  for (const phrase of variants) {
    const index = normalized.indexOf(phrase);

    if (index !== -1) {
      return normalized
        .slice(index + phrase.length)
        .replace(/^[\s,.:;!?\u3001\u3002\uff0c\uff1f\uff01\uff1a\uff1b-]+/, '')
        .trim();
    }
  }

  return null;
}

// 判断用户是否说出了停止语音模式的命令。
function isStopVoiceCommand(text: string) {
  const normalized = normalizeVoiceText(text);
  const compact = normalized.replace(/\s+/g, '');

  return [
    'stop voice',
    'stop listening',
    'exit voice',
    'cancel voice',
    '退出语音',
    '停止语音',
    '结束语音',
    '关闭语音'
  ].some((phrase) => normalized.includes(phrase) || compact.includes(phrase.replace(/\s+/g, '')));
}

// 判断语音命令是否是生图请求。
function isImageCommand(text: string) {
  const normalized = normalizeVoiceText(text);
  const compact = normalized.replace(/\s+/g, '');

  return /(^|\s)(draw|paint)\b/.test(normalized)
    || /(^|\s)(generate|create|make)\b.*\b(image|picture|pic|drawing|art)\b/.test(normalized)
    || compact.includes('生图')
    || compact.includes('画图')
    || compact.includes('画一张')
    || compact.includes('生成图片')
    || compact.includes('生成一张')
    || compact.includes('绘制图')
    || compact.includes('生成图像');
}

// 从生图语音命令中剥离“帮我画图”等触发词，保留真正提示词。
function cleanImagePrompt(text: string) {
  const wakeCommand = extractWakeCommand(text);
  let prompt = String(wakeCommand === null ? text : wakeCommand).trim();
  const original = prompt;

  prompt = prompt
    .replace(/^(please\s+)?(draw|paint|generate|create|make)\s+(me\s+)?(an?\s+)?(image|picture|pic|drawing|art)?\s*(of|about|for)?\s*/i, '')
    .trim();

  for (const phrase of [
    '帮我',
    '请',
    '给我',
    '画一张',
    '画图',
    '画',
    '生图',
    '生成图片',
    '生成一张',
    '生成图像',
    '绘制图片',
    '绘制'
  ]) {
    prompt = prompt.replace(new RegExp(`^\\s*${phrase}\\s*`, 'u'), '').trim();
  }

  prompt = prompt.replace(/^[\s:,\u3002\uff0c\uff1a;!-]+/u, '').trim();
  return prompt || (isImageCommand(original) ? '' : original.trim());
}

// 根据语音文本执行停止、生成图片或普通问答。
async function handleVoiceCommand(text: string) {
  const command = (extractWakeCommand(text) ?? text).trim();

  if (!command) {
    setCompactAnswer(t('voiceNeed'), true);
    return;
  }

  if (isStopVoiceCommand(command)) {
    stopVoiceMode(t('voiceClosed'));
    return;
  }

  if (isImageCommand(command)) {
    await runImageRequest(cleanImagePrompt(command));
    return;
  }

  companionState.compactPrompt = command;
  await runAssistantRequest(command, {
    clearInput: true,
    pendingText: t('answeringVoice')
  });
}

// 开关语音输入：首次开启会请求麦克风权限并启动分段录音。
export async function toggleVoiceInput() {
  if (companionState.isRecording) {
    stopVoiceMode(t('voiceClosed'));
    return;
  }

  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    setCompactAnswer(t('voiceUnavailable'));
    return;
  }

  try {
    await window.companion.saveSettings(buildSettingsPayload());
    companionState.isRecording = true;
    companionState.voiceAwake = false;
    setCompactAnswer(t('waitingWake'), true);
    await startVoiceSegment();
  } catch (error: unknown) {
    stopVoiceMode(errorMessage(error, t('microphoneDenied')));
  }
}
