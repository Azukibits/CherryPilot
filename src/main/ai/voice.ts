// @ts-nocheck
// 语音识别服务
// 从可用模型接口中挑选语音候选服务，并把音频 Blob 提交给转写接口。
import { DEFAULT_SETTINGS } from '@/main/entity';
import { readSettings } from '@/main/settings';
import {
  getActiveProvider,
  getAudioTranscriptionsUrl,
  getAuthHeaders,
  isAnthropicBaseUrl,
  isLocalBaseUrl
} from '@/main/ai/provider-client';

function getAudioExtension(mimeType = '') {
  if (mimeType.includes('mp4') || mimeType.includes('m4a')) {
    return 'm4a';
  }
  if (mimeType.includes('ogg')) {
    return 'ogg';
  }
  if (mimeType.includes('wav')) {
    return 'wav';
  }
  return 'webm';
}

function isAudioModelName(model = '') {
  return /whisper|transcribe|transcription|stt|speech[-_ ]?to[-_ ]?text|gpt-4o(?:-mini)?-transcribe/i.test(String(model || ''));
}

function isOpenAIAudioBaseUrl(baseUrl = '') {
  try {
    const { hostname } = new URL(String(baseUrl || ''));
    return /(^|\.)openai\.com$/i.test(hostname) || /openai/i.test(hostname);
  } catch {
    return false;
  }
}

function canUseAudioProvider(provider = {}) {
  return Boolean(
    provider?.baseUrl
    && !isAnthropicBaseUrl(provider.baseUrl)
    && (provider.apiKey || isLocalBaseUrl(provider.baseUrl))
  );
}

function getAudioProviderCandidates(settings) {
  const providers = Array.isArray(settings.providers) ? settings.providers : [];
  const activeProvider = getActiveProvider(settings);
  const settingsProvider = {
    apiKey: settings.apiKey || process.env.AI_API_KEY || process.env.OPENAI_API_KEY,
    baseUrl: settings.baseUrl || process.env.AI_BASE_URL || DEFAULT_SETTINGS.baseUrl,
    model: settings.model
  };
  const pool = [activeProvider, ...providers, settingsProvider].filter(canUseAudioProvider);
  const ordered = [
    ...pool.filter((provider) => isAudioModelName(provider.model)),
    ...pool.filter((provider) => isOpenAIAudioBaseUrl(provider.baseUrl)),
    ...pool
  ];
  const seen = new Set();
  const candidates = [];

  for (const provider of ordered) {
    const key = [
      String(provider.baseUrl || '').trim().replace(/\/+$/, ''),
      String(provider.apiKey || ''),
      String(provider.model || '')
    ].join('\n');

    if (!seen.has(key)) {
      seen.add(key);
      candidates.push(provider);
    }
  }

  return candidates;
}

function getTranscribeModel(provider = {}) {
  if (process.env.AI_TRANSCRIBE_MODEL) {
    return process.env.AI_TRANSCRIBE_MODEL;
  }

  return isAudioModelName(provider.model) ? provider.model : 'whisper-1';
}

// 使用支持 /audio/transcriptions 的接口进行语音转文字。
export async function transcribeAudio(payload = {}) {
  const settings = await readSettings();
  if (!payload.audioBuffer) {
    throw new Error('没有收到语音数据');
  }

  const mimeType = String(payload.mimeType || 'audio/webm');
  const audioBytes = Buffer.from(new Uint8Array(payload.audioBuffer));

  if (audioBytes.length < 1024) {
    throw new Error('语音太短，请重新录制');
  }

  const candidates = getAudioProviderCandidates(settings);

  if (candidates.length === 0) {
    throw new Error('请先配置支持语音识别的接口：Base URL 需要支持 /audio/transcriptions，模型可填 whisper-1 或 gpt-4o-mini-transcribe');
  }

  let lastError = null;

  for (const provider of candidates) {
    const apiKey = String(provider.apiKey || process.env.AI_API_KEY || process.env.OPENAI_API_KEY || '').trim();
    const baseUrl = String(provider.baseUrl || process.env.AI_BASE_URL || DEFAULT_SETTINGS.baseUrl).trim();

    if (!apiKey && !isLocalBaseUrl(baseUrl)) {
      continue;
    }

    const form = new FormData();
    form.append('file', new Blob([audioBytes], { type: mimeType }), `voice.${getAudioExtension(mimeType)}`);
    form.append('model', getTranscribeModel(provider));

    const url = getAudioTranscriptionsUrl(baseUrl);
    const response = await fetch(url, {
      method: 'POST',
      headers: getAuthHeaders(apiKey, baseUrl),
      body: form
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message = result.error?.message || `语音识别失败：HTTP ${response.status}`;
      const error = new Error(message);
      error.statusCode = response.status;
      lastError = error;

      if (response.status === 404) {
        continue;
      }

      throw error;
    }

    const text = String(result.text || '').trim();
    if (!text) {
      throw new Error('语音识别返回为空');
    }

    return {
      text,
      transcribedAt: new Date().toISOString()
    };
  }

  if (lastError?.statusCode === 404) {
    throw new Error('当前接口不支持语音识别（HTTP 404）。请在任一接口配置支持 /audio/transcriptions 的 OpenAI 兼容服务，并将该接口模型填为 whisper-1 或 gpt-4o-mini-transcribe。');
  }

  throw lastError || new Error('请先在接口设置里填写可用于语音识别的 API Key');
}
