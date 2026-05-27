<script setup lang="ts">
import ProviderCard from './ProviderCard.vue';

const providers = [
  {
    providerIndex: 0,
    title: '01 接口',
    meta: 'Key / URL / 模型',
    apiKeyId: 'apiKeyInput',
    apiKeyPlaceholder: 'sk-...',
    baseUrlId: 'baseUrlInput',
    baseUrlPlaceholder: 'https://api.openai.com/v1',
    modelId: 'modelInput',
    modelPlaceholder: 'gpt-4o-mini',
    modelComboId: 'modelCombo',
    modelMenuButtonId: 'modelMenuButton',
    modelMenuId: 'modelMenu',
    modelEmpty: '刷新后选择模型',
    refreshButtonId: 'refreshModelsButton',
    modelMenuTitle: '选择模型',
    refreshTitle: '刷新模型'
  },
  {
    providerIndex: 1,
    title: '02 接口',
    meta: 'Key / URL / 模型',
    apiKeyId: 'imageApiKeyInput',
    apiKeyPlaceholder: 'sk-...',
    baseUrlId: 'imageBaseUrlInput',
    baseUrlPlaceholder: 'https://api.openai.com/v1',
    modelId: 'imageModelInput',
    modelPlaceholder: 'model id',
    modelComboId: 'imageModelCombo',
    modelMenuButtonId: 'imageModelMenuButton',
    modelMenuId: 'imageModelMenu',
    modelEmpty: '刷新后选择模型',
    refreshButtonId: 'imageRefreshModelsButton',
    modelMenuTitle: '选择模型',
    refreshTitle: '刷新模型'
  },
  {
    providerIndex: 2,
    title: '03 接口',
    meta: 'Key / URL / 模型',
    apiKeyId: 'claudeApiKeyInput',
    apiKeyPlaceholder: 'sk-...',
    baseUrlId: 'claudeBaseUrlInput',
    baseUrlPlaceholder: 'https://api.openai.com/v1',
    modelId: 'claudeModelInput',
    modelPlaceholder: 'model id',
    modelComboId: 'claudeModelCombo',
    modelMenuButtonId: 'claudeModelMenuButton',
    modelMenuId: 'claudeModelMenu',
    modelEmpty: '刷新后选择模型',
    refreshButtonId: 'claudeRefreshModelsButton',
    modelMenuTitle: '选择模型',
    refreshTitle: '刷新模型'
  },
  {
    providerIndex: 3,
    title: '本地模型',
    meta: 'Ollama / LM Studio',
    apiKeyId: 'localApiKeyInput',
    apiKeyPlaceholder: '本地服务通常留空',
    baseUrlId: 'localBaseUrlInput',
    baseUrlPlaceholder: 'http://127.0.0.1:11434/v1',
    modelId: 'localModelInput',
    modelPlaceholder: 'qwen2.5:7b',
    modelComboId: 'localModelCombo',
    modelMenuButtonId: 'localModelMenuButton',
    modelMenuId: 'localModelMenu',
    modelEmpty: '刷新后选择本地模型',
    refreshButtonId: 'localRefreshModelsButton',
    modelMenuTitle: '选择本地模型',
    refreshTitle: '刷新本地模型'
  }
];
</script>

<template>
  <section class="settings-panel panel">
    <div class="panel-row">
      <h2>接口</h2>
      <span class="status-text" id="settingsStatus">等待 API Key</span>
    </div>
    <div class="theme-switch" id="themeSwitch" aria-label="Theme">
      <button class="theme-choice is-active" id="themeDarkButton" type="button">Dark</button>
      <button class="theme-choice" id="themeLightButton" type="button">Light</button>
    </div>
    <div class="provider-stack">
      <ProviderCard
        v-for="provider in providers"
        :key="provider.providerIndex"
        :provider="provider"
        :local="provider.providerIndex === 3"
      />
    </div>

    <section class="permission-card">
      <div class="provider-head">
        <strong>工作文件夹</strong>
        <span id="workspaceAccessStatus">未授权</span>
      </div>
      <div class="permission-workspace">
        <label class="field">
          <span>AI 可操作目录</span>
          <input id="workspaceRootInput" type="text" spellcheck="false" autocomplete="off" readonly placeholder="选择文件夹即授权 AI 在其中工作" />
        </label>
        <button class="field-icon-button" id="chooseWorkspaceButton" type="button" title="选择并授权工作文件夹" aria-label="选择并授权工作文件夹">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 7h6l2 2h10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <path d="M3 7v11" />
          </svg>
        </button>
      </div>
      <div class="permission-actions">
        <button class="permission-link-button" id="clearWorkspaceButton" type="button">取消授权</button>
      </div>
      <label class="permission-toggle">
        <input id="commandAccessToggle" type="checkbox" />
        <span>允许 AI 在该文件夹内运行调试、构建和发布命令</span>
      </label>
    </section>

    <section class="system-card">
      <div class="provider-head">
        <strong>系统</strong>
        <span id="startupLaunchStatus">未开启</span>
      </div>
      <label class="permission-toggle">
        <input id="startupLaunchToggle" type="checkbox" />
        <span>开机自启 CherryPilot</span>
      </label>
      <label class="permission-toggle">
        <input id="lowCpuModeToggle" type="checkbox" checked />
        <span>低 CPU 模式</span>
      </label>
    </section>

    <section class="lan-card">
      <div class="provider-head">
        <strong>局域网共享</strong>
        <span id="lanShareStatus">未开启</span>
      </div>
      <label class="permission-toggle">
        <input id="lanShareToggle" type="checkbox" />
        <span>允许同一局域网设备发送资料</span>
      </label>
      <div class="lan-share-url" id="lanShareUrl">开启后显示访问地址</div>
    </section>

    <section class="guide-card">
      <div class="provider-head">
        <strong>使用说明</strong>
        <div class="guide-tabs" aria-label="Guide language">
          <button class="guide-tab is-active" type="button" data-guide-lang="zh">中文</button>
          <button class="guide-tab" type="button" data-guide-lang="en">EN</button>
          <button class="guide-tab" type="button" data-guide-lang="ja">日本語</button>
        </div>
      </div>
      <div class="guide-body" id="guideBody"></div>
    </section>

    <button class="command-button quiet" id="saveSettingsButton">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 5a2 2 0 0 1 2-2h10l4 4v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM8 3v6h8V4M8 21v-7h8v7" />
      </svg>
      <span data-button-label>保存接口配置</span>
    </button>
  </section>
</template>
