import {
  GUIDE_CONTENT,
  GUIDE_LANGUAGE_KEY,
  UI_TEXT,
  type GuideLanguage,
  type TextKey
} from '@/renderer/entity';

export {
  GUIDE_CONTENT,
  GUIDE_LANGUAGE_KEY,
  UI_TEXT,
  type GuideLanguage,
  type TextKey
};

// 将持久化或外部传入的语言值归一化到受支持的语言枚举。
export function normalizeGuideLanguage(language: string | null | undefined): GuideLanguage {
  return language === 'en' || language === 'ja' ? language : 'zh';
}

// 按当前语言读取界面文案，缺失时回退到中文文案或 key。
export function textFor(language: string, key: TextKey): string {
  const normalized = normalizeGuideLanguage(language);
  return UI_TEXT[normalized][key] || UI_TEXT.zh[key] || key;
}

// 对带占位符的文案做简单插值，例如把 {model} 替换成实际模型名。
export function formatText(
  language: string,
  key: TextKey,
  values: Record<string, unknown> = {}
): string {
  return textFor(language, key).replace(/\{(\w+)\}/g, (_match, name) => (
    Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : ''
  ));
}
