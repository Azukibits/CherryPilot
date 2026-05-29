// @ts-nocheck
// AI Provider 基础能力
// 统一处理模型接口地址、鉴权头、本地服务判断和模型列表拉取。
import { DEFAULT_SETTINGS, LAST_PROVIDER_INDEX } from '@/main/entity';
import { readSettings } from '@/main/settings';

// 根据 Base URL 生成聊天补全接口地址。
export function getChatCompletionsUrl(baseUrl) {
  const cleaned = String(baseUrl || DEFAULT_SETTINGS.baseUrl).trim().replace(/\/+$/, '');
  return cleaned.endsWith('/chat/completions') ? cleaned : `${cleaned}/chat/completions`;
}

// 根据 Base URL 生成模型列表接口地址。
export function getModelsUrl(baseUrl) {
  const cleaned = String(baseUrl || DEFAULT_SETTINGS.baseUrl).trim().replace(/\/+$/, '');
  const chatPath = '/chat/completions';
  return cleaned.endsWith(chatPath) ? `${cleaned.slice(0, -chatPath.length)}/models` : `${cleaned}/models`;
}

export function isAnthropicBaseUrl(baseUrl) {
  return /anthropic|claude/i.test(String(baseUrl || ''));
}

export function isLocalBaseUrl(baseUrl) {
  try {
    const { hostname } = new URL(String(baseUrl || ''));
    return ['127.0.0.1', 'localhost', '::1', '0.0.0.0'].includes(hostname);
  } catch {
    return false;
  }
}

// 按不同服务商生成鉴权请求头。
export function getAuthHeaders(apiKey, baseUrl) {
  if (isAnthropicBaseUrl(baseUrl)) {
    return apiKey
      ? { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }
      : { 'anthropic-version': '2023-06-01' };
  }

  return apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
}

export function getAudioTranscriptionsUrl(baseUrl) {
  const cleaned = String(baseUrl || DEFAULT_SETTINGS.baseUrl).trim().replace(/\/+$/, '');
  const suffixes = [
    '/chat/completions',
    '/responses',
    '/models',
    '/audio/transcriptions'
  ];
  const suffix = suffixes.find((item) => cleaned.endsWith(item));
  const base = suffix ? cleaned.slice(0, -suffix.length) : cleaned;
  return base.endsWith('/audio/transcriptions') ? base : `${base}/audio/transcriptions`;
}

export function getImageGenerationsUrl(baseUrl) {
  const cleaned = String(baseUrl || DEFAULT_SETTINGS.baseUrl).trim().replace(/\/+$/, '');
  const chatPath = '/chat/completions';
  const modelsPath = '/models';
  const base = cleaned.endsWith(chatPath)
    ? cleaned.slice(0, -chatPath.length)
    : cleaned.endsWith(modelsPath)
      ? cleaned.slice(0, -modelsPath.length)
      : cleaned;

  return base.endsWith('/images/generations') ? base : `${base}/images/generations`;
}

export function normalizeModelList(payload) {
  const rawItems = Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload?.models)
      ? payload.models
      : [];

  return [...new Set(rawItems
    .map((item) => (typeof item === 'string' ? item : item?.id || item?.name))
    .filter(Boolean)
    .map(String))]
    .sort((a, b) => a.localeCompare(b));
}

// 拉取当前配置或临时覆盖配置下的模型列表。
export async function listModels(overrides = {}) {
  const settings = await readSettings();
  const rawApiKey = Object.hasOwn(overrides, 'apiKey') ? overrides.apiKey : settings.apiKey;
  const rawBaseUrl = Object.hasOwn(overrides, 'baseUrl') ? overrides.baseUrl : settings.baseUrl;
  const baseUrl = String(rawBaseUrl || process.env.AI_BASE_URL || DEFAULT_SETTINGS.baseUrl).trim();
  const apiKey = String(rawApiKey || (!isLocalBaseUrl(baseUrl) ? process.env.AI_API_KEY || process.env.OPENAI_API_KEY : '') || '').trim();

  if (!apiKey && !isLocalBaseUrl(baseUrl)) {
    throw new Error('请先填写 API Key');
  }

  const response = await fetch(getModelsUrl(baseUrl), {
    method: 'GET',
    headers: {
      ...getAuthHeaders(apiKey, baseUrl),
      'Content-Type': 'application/json'
    }
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = payload.error?.message || `模型列表请求失败：HTTP ${response.status}`;
    throw new Error(message);
  }

  return {
    models: normalizeModelList(payload),
    fetchedAt: new Date().toISOString()
  };
}

// 获取设置中的当前活动模型接口。
export function getActiveProvider(settings) {
  const activeProviderIndex = Math.min(LAST_PROVIDER_INDEX, Math.max(0, Number(settings.activeProviderIndex || 0)));
  return settings.providers?.[activeProviderIndex] || settings.providers?.[0] || settings;
}
