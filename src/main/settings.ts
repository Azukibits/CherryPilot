// @ts-nocheck
// 设置读写服务
// 负责默认配置归一化、持久化保存和开机自启动设置。
import path from 'node:path';
import fs from 'node:fs/promises';
import { app } from 'electron';
import { DEFAULT_PROVIDERS, DEFAULT_SETTINGS, LAST_PROVIDER_INDEX } from '@/main/entity';
import { applyPerformanceRuntime } from '@/main/active-context';

function getSettingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function normalizeProvider(value = {}, index = 0) {
  const defaults = DEFAULT_PROVIDERS[index] || DEFAULT_PROVIDERS[0];
  const baseUrl = String(value.baseUrl || defaults.baseUrl).trim().replace(/\/+$/, '');

  return {
    id: defaults.id,
    label: defaults.label,
    local: Boolean(defaults.local),
    apiKey: String(value.apiKey || '').trim(),
    baseUrl: baseUrl || defaults.baseUrl,
    model: String(value.model || defaults.model || '').trim()
  };
}

function normalizeComputerAccess(value = {}) {
  const workspaceRoot = String(value.workspaceRoot || '').trim();

  return {
    enabled: Boolean(workspaceRoot),
    workspaceRoot,
    allowCommands: Boolean(workspaceRoot && value.allowCommands)
  };
}

function normalizePerformance(value = {}) {
  return {
    lowCpuMode: value.lowCpuMode !== false
  };
}

function normalizeLanShare(value = {}) {
  const port = Math.max(0, Math.min(65535, Number(value.port || 0) || 0));
  const token = String(value.token || '').trim();

  return {
    enabled: Boolean(value.enabled),
    port,
    token
  };
}

function normalizeSettings(value = {}) {
  const theme = ['light', 'dark'].includes(value.theme) ? value.theme : DEFAULT_SETTINGS.theme;
  const activeProviderIndex = Math.min(LAST_PROVIDER_INDEX, Math.max(0, Number(value.activeProviderIndex || 0)));
  const rawProviders = Array.isArray(value.providers) ? value.providers : [];
  const providers = DEFAULT_PROVIDERS.map((defaults, index) => normalizeProvider({
    ...defaults,
    ...(rawProviders[index] || {}),
    ...(index === 0 && rawProviders.length === 0
      ? {
          apiKey: value.apiKey,
          baseUrl: value.baseUrl,
          model: value.model
        }
      : {})
  }, index));
  const chatProvider = providers[0];

  return {
    apiKey: chatProvider.apiKey,
    baseUrl: chatProvider.baseUrl,
    model: chatProvider.model || DEFAULT_SETTINGS.model,
    theme,
    activeProviderIndex,
    providers,
    computerAccess: normalizeComputerAccess(value.computerAccess || DEFAULT_SETTINGS.computerAccess),
    performance: normalizePerformance(value.performance || DEFAULT_SETTINGS.performance),
    lanShare: normalizeLanShare(value.lanShare || DEFAULT_SETTINGS.lanShare)
  };
}

// 读取并归一化用户设置。
export async function readSettings() {
  try {
    const raw = await fs.readFile(getSettingsPath(), 'utf8');
    return normalizeSettings(JSON.parse(raw));
  } catch {
    return normalizeSettings(DEFAULT_SETTINGS);
  }
}

// 保存用户设置并同步运行时性能参数。
export async function saveSettings(value) {
  const settings = normalizeSettings(value);
  await fs.mkdir(app.getPath('userData'), { recursive: true });
  await fs.writeFile(getSettingsPath(), JSON.stringify(settings, null, 2), 'utf8');
  applyPerformanceRuntime(settings);
  return settings;
}

// 读取系统开机自启动状态。
export function getStartupSettings() {
  const settings = app.getLoginItemSettings({ path: process.execPath });

  return {
    openAtLogin: Boolean(settings.openAtLogin),
    wasOpenedAtLogin: Boolean(settings.wasOpenedAtLogin),
    executablePath: process.execPath
  };
}

// 写入系统开机自启动状态。
export function setStartupSettings(enabled) {
  app.setLoginItemSettings({
    openAtLogin: Boolean(enabled),
    path: process.execPath
  });

  return getStartupSettings();
}
