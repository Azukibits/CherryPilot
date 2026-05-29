// @ts-nocheck
// 图片生成服务
// 从支持生图的模型接口中选择 provider，并返回可直接展示的图片 DataURL 或远程 URL。
import { DEFAULT_SETTINGS } from '@/main/entity';
import { readSettings } from '@/main/settings';
import { getActiveProvider, getAuthHeaders, getImageGenerationsUrl, isLocalBaseUrl } from '@/main/ai/provider-client';

function isImageModelName(model = '') {
  return /image|img|dall|flux|stable|sd|midjourney|gpt-image|seedream|t2i|txt2img|imagen/i.test(String(model || ''));
}

function getImageProvider(settings) {
  const providers = Array.isArray(settings.providers) ? settings.providers : [];
  const imageProvider = providers.find((provider) => (
    provider?.apiKey
    && provider?.baseUrl
    && isImageModelName(provider.model)
  ));

  return imageProvider || getActiveProvider(settings);
}

// 调用图片生成接口并归一化返回的图片地址。
export async function generateImage(payload = {}) {
  const prompt = String(payload.prompt || '').trim();
  if (!prompt) {
    throw new Error('请输入生图提示词');
  }

  const settings = await readSettings();
  const provider = getImageProvider(settings);
  const baseUrl = provider.baseUrl || process.env.AI_IMAGE_BASE_URL || process.env.AI_BASE_URL || DEFAULT_SETTINGS.baseUrl;
  const apiKey = provider.apiKey || (!isLocalBaseUrl(baseUrl) ? process.env.AI_IMAGE_API_KEY || process.env.AI_API_KEY || process.env.OPENAI_API_KEY : '');
  const providerModel = String(provider.model || '').trim();
  const model = String(payload.model || (isImageModelName(providerModel) ? providerModel : '') || process.env.AI_IMAGE_MODEL || 'gpt-image-1').trim();

  if (!apiKey && !isLocalBaseUrl(baseUrl)) {
    throw new Error('请先在主页面配置可用于生图的 API Key');
  }

  const response = await fetch(getImageGenerationsUrl(baseUrl), {
    method: 'POST',
    headers: {
      ...getAuthHeaders(apiKey, baseUrl),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      prompt,
      n: 1,
      size: payload.size || '1024x1024'
    })
  });
  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = result.error?.message || `生图请求失败：HTTP ${response.status}`;
    throw new Error(message);
  }

  const image = Array.isArray(result.data) ? result.data[0] : null;
  const imageDataUrl = image?.b64_json
    ? `data:image/png;base64,${image.b64_json}`
    : String(image?.url || '');

  if (!imageDataUrl) {
    throw new Error('生图接口没有返回图片');
  }

  return {
    imageDataUrl,
    prompt,
    model,
    generatedAt: new Date().toISOString()
  };
}
