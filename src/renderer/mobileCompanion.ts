// @ts-nocheck
(function () {
  if (window.companion) {
    return;
  }

  const SETTINGS_KEY = 'companion.settings.v2';
  const MAX_ATTACHMENT_CHARS = 18000;
  const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;
  const MAX_INGEST_FILES = 12;
  const DEFAULT_PROVIDERS = [
    { id: 'chat', label: 'Interface 1', apiKey: '', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
    { id: 'slot2', label: 'Interface 2', apiKey: '', baseUrl: 'https://api.openai.com/v1', model: '' },
    { id: 'slot3', label: 'Interface 3', apiKey: '', baseUrl: 'https://api.openai.com/v1', model: '' },
    { id: 'local', label: 'Local model', apiKey: '', baseUrl: 'http://127.0.0.1:11434/v1', model: '', local: true }
  ];
  const DEFAULT_SETTINGS = {
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    theme: 'dark',
    activeProviderIndex: 0,
    providers: DEFAULT_PROVIDERS,
    computerAccess: { enabled: false, workspaceRoot: '', allowCommands: false },
    performance: { lowCpuMode: true },
    lanShare: { enabled: false, port: 0, token: '' }
  };
  const listeners = new Map();
  let windowMode = {
    mode: 'expanded',
    dockSide: 'right',
    revealed: true,
    docked: false,
    answerZoomed: false
  };

  function listen(channel, callback) {
    if (typeof callback !== 'function') {
      return () => {};
    }

    const callbacks = listeners.get(channel) || new Set();
    callbacks.add(callback);
    listeners.set(channel, callbacks);
    return () => callbacks.delete(callback);
  }

  function emit(channel, payload) {
    for (const callback of listeners.get(channel) || []) {
      callback(payload);
    }
  }

  function normalizeProvider(provider = {}, index = 0) {
    return {
      ...DEFAULT_PROVIDERS[index],
      ...provider,
      id: DEFAULT_PROVIDERS[index]?.id || provider.id || `slot${index + 1}`,
      label: DEFAULT_PROVIDERS[index]?.label || provider.label || `Interface ${index + 1}`
    };
  }

  function normalizeSettings(value = {}) {
    const providers = DEFAULT_PROVIDERS.map((provider, index) => normalizeProvider(value.providers?.[index] || provider, index));

    return {
      ...DEFAULT_SETTINGS,
      ...value,
      activeProviderIndex: Math.min(providers.length - 1, Math.max(0, Number(value.activeProviderIndex || 0))),
      providers,
      computerAccess: {
        ...DEFAULT_SETTINGS.computerAccess,
        ...(value.computerAccess || {}),
        enabled: false,
        workspaceRoot: '',
        allowCommands: false
      },
      performance: {
        ...DEFAULT_SETTINGS.performance,
        ...(value.performance || {})
      },
      lanShare: {
        ...DEFAULT_SETTINGS.lanShare,
        ...(value.lanShare || {}),
        enabled: false
      }
    };
  }

  async function getSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      return normalizeSettings(raw ? JSON.parse(raw) : {});
    } catch {
      return normalizeSettings();
    }
  }

  async function saveSettings(payload = {}) {
    const current = await getSettings();
    const next = normalizeSettings({ ...current, ...payload });
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    return next;
  }

  function cleanBaseUrl(baseUrl) {
    return String(baseUrl || DEFAULT_SETTINGS.baseUrl).trim().replace(/\/+$/, '');
  }

  function getChatCompletionsUrl(baseUrl) {
    const cleaned = cleanBaseUrl(baseUrl);
    return cleaned.endsWith('/chat/completions') ? cleaned : `${cleaned}/chat/completions`;
  }

  function getModelsUrl(baseUrl) {
    const cleaned = cleanBaseUrl(baseUrl);
    const chatPath = '/chat/completions';
    return cleaned.endsWith(chatPath) ? `${cleaned.slice(0, -chatPath.length)}/models` : `${cleaned}/models`;
  }

  function getAudioTranscriptionsUrl(baseUrl) {
    const cleaned = cleanBaseUrl(baseUrl);
    const suffixes = ['/chat/completions', '/responses', '/models', '/audio/transcriptions'];
    const suffix = suffixes.find((item) => cleaned.endsWith(item));
    const base = suffix ? cleaned.slice(0, -suffix.length) : cleaned;
    return base.endsWith('/audio/transcriptions') ? base : `${base}/audio/transcriptions`;
  }

  function getImageGenerationsUrl(baseUrl) {
    const cleaned = cleanBaseUrl(baseUrl);
    const suffixes = ['/chat/completions', '/responses', '/models', '/images/generations'];
    const suffix = suffixes.find((item) => cleaned.endsWith(item));
    const base = suffix ? cleaned.slice(0, -suffix.length) : cleaned;
    return base.endsWith('/images/generations') ? base : `${base}/images/generations`;
  }

  function isLocalBaseUrl(baseUrl) {
    try {
      const { hostname } = new URL(String(baseUrl || ''));
      return ['127.0.0.1', 'localhost', '::1', '0.0.0.0'].includes(hostname);
    } catch {
      return false;
    }
  }

  function isAnthropicBaseUrl(baseUrl) {
    return /anthropic|claude/i.test(String(baseUrl || ''));
  }

  function getAuthHeaders(apiKey, baseUrl) {
    if (isAnthropicBaseUrl(baseUrl)) {
      return apiKey
        ? { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }
        : { 'anthropic-version': '2023-06-01' };
    }

    return apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
  }

  function normalizeModelList(payload) {
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

  function getActiveProvider(settings) {
    const index = Math.min(DEFAULT_PROVIDERS.length - 1, Math.max(0, Number(settings.activeProviderIndex || 0)));
    return settings.providers?.[index] || settings.providers?.[0] || settings;
  }

  function buildAttachmentText(attachments = []) {
    const valid = attachments.filter((item) => item && item.text);

    if (valid.length === 0) {
      return 'Attachments: none';
    }

    return [
      `Attachments: ${valid.length}`,
      ...valid.map((item, index) => [
        `--- Attachment ${index + 1}: ${item.name || 'untitled'} ---`,
        String(item.text).slice(0, MAX_ATTACHMENT_CHARS)
      ].join('\n'))
    ].join('\n\n');
  }

  function buildAnalysisPrompt({ activeTitle, note, attachments }) {
    return [
      activeTitle ? `Current context: ${activeTitle}` : 'Current context: unavailable on Android/Web.',
      note ? `User request: ${note}` : 'User request: answer from the provided context.',
      buildAttachmentText(attachments),
      '',
      'Answer in the user language. Be concise, accurate, and actionable. Do not invent details that are not present.'
    ].join('\n');
  }

  async function postJson(url, apiKey, baseUrl, body) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(apiKey, baseUrl),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload.error?.message || `Request failed: HTTP ${response.status}`);
    }

    return payload;
  }

  async function listModels(overrides = {}) {
    const settings = await getSettings();
    const rawApiKey = Object.hasOwn(overrides, 'apiKey') ? overrides.apiKey : settings.apiKey;
    const rawBaseUrl = Object.hasOwn(overrides, 'baseUrl') ? overrides.baseUrl : settings.baseUrl;
    const baseUrl = String(rawBaseUrl || DEFAULT_SETTINGS.baseUrl).trim();
    const apiKey = String(rawApiKey || '').trim();

    if (!apiKey && !isLocalBaseUrl(baseUrl)) {
      throw new Error('Please fill in API Key first.');
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
      throw new Error(payload.error?.message || `Model list failed: HTTP ${response.status}`);
    }

    return {
      models: normalizeModelList(payload),
      fetchedAt: new Date().toISOString()
    };
  }

  async function analyzeContext(payload = {}) {
    if (!payload.imageDataUrl && (!payload.attachments || payload.attachments.length === 0) && !payload.note) {
      throw new Error('Enter a question or add a file first.');
    }

    const settings = await getSettings();
    const provider = getActiveProvider(settings);
    const baseUrl = provider.baseUrl || DEFAULT_SETTINGS.baseUrl;
    const apiKey = provider.apiKey || '';
    const model = provider.model || DEFAULT_SETTINGS.model;

    if (!apiKey && !isLocalBaseUrl(baseUrl)) {
      throw new Error('Please fill in API Key first.');
    }

    const userContent = [
      {
        type: 'text',
        text: buildAnalysisPrompt(payload)
      }
    ];

    if (payload.imageDataUrl && String(payload.imageDataUrl).startsWith('data:image/')) {
      userContent.push({
        type: 'image_url',
        image_url: { url: payload.imageDataUrl }
      });
    }

    const result = await postJson(getChatCompletionsUrl(baseUrl), apiKey, baseUrl, {
      model,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: 'You are CherryPilot, a concise AI companion. Answer from the supplied context.'
        },
        {
          role: 'user',
          content: userContent
        }
      ]
    });
    const content = result.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('AI returned an empty response.');
    }

    return {
      content,
      model,
      analyzedAt: new Date().toISOString()
    };
  }

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

  async function transcribeAudio(payload = {}) {
    if (!payload.audioBuffer) {
      throw new Error('No voice data received.');
    }

    const settings = await getSettings();
    const provider = getActiveProvider(settings);
    const baseUrl = provider.baseUrl || DEFAULT_SETTINGS.baseUrl;
    const apiKey = provider.apiKey || '';
    const model = /whisper|transcribe|speech[-_ ]?to[-_ ]?text/i.test(provider.model || '')
      ? provider.model
      : 'whisper-1';

    if (!apiKey && !isLocalBaseUrl(baseUrl)) {
      throw new Error('Please configure an API key for voice transcription.');
    }

    const mimeType = String(payload.mimeType || 'audio/webm');
    const form = new FormData();
    form.append('file', new Blob([payload.audioBuffer], { type: mimeType }), `voice.${getAudioExtension(mimeType)}`);
    form.append('model', model);

    const response = await fetch(getAudioTranscriptionsUrl(baseUrl), {
      method: 'POST',
      headers: getAuthHeaders(apiKey, baseUrl),
      body: form
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(result.error?.message || `Voice transcription failed: HTTP ${response.status}`);
    }

    const text = String(result.text || '').trim();
    if (!text) {
      throw new Error('Voice transcription returned empty text.');
    }

    return {
      text,
      transcribedAt: new Date().toISOString()
    };
  }

  async function generateImage(payload = {}) {
    const prompt = String(payload.prompt || '').trim();
    if (!prompt) {
      throw new Error('Enter an image prompt first.');
    }

    const settings = await getSettings();
    const provider = getActiveProvider(settings);
    const baseUrl = provider.baseUrl || DEFAULT_SETTINGS.baseUrl;
    const apiKey = provider.apiKey || '';
    const model = /image|img|dall|flux|stable|sd|gpt-image/i.test(provider.model || '')
      ? provider.model
      : 'gpt-image-1';

    if (!apiKey && !isLocalBaseUrl(baseUrl)) {
      throw new Error('Please configure an API key for image generation.');
    }

    const result = await postJson(getImageGenerationsUrl(baseUrl), apiKey, baseUrl, {
      model,
      prompt,
      n: 1,
      size: payload.size || '1024x1024'
    });
    const image = Array.isArray(result.data) ? result.data[0] : null;
    const imageDataUrl = image?.b64_json
      ? `data:image/png;base64,${image.b64_json}`
      : String(image?.url || '');

    if (!imageDataUrl) {
      throw new Error('Image API returned no image.');
    }

    return {
      imageDataUrl,
      prompt,
      model,
      generatedAt: new Date().toISOString()
    };
  }

  function isSupportedTextFile(name = '') {
    return /\.(txt|md|markdown|json|csv|log|xml|html|css|js|ts|py|java|cpp|c|h)$/i.test(name);
  }

  async function ingestBrowserFiles(fileList = []) {
    const files = Array.from(fileList).slice(0, MAX_INGEST_FILES);
    const results = [];

    for (const file of files) {
      try {
        if (file.size > MAX_ATTACHMENT_BYTES) {
          throw new Error(`File is larger than ${Math.round(MAX_ATTACHMENT_BYTES / 1024 / 1024)} MB.`);
        }
        if (!isSupportedTextFile(file.name)) {
          throw new Error('This file type is only supported in the desktop app.');
        }

        const text = await file.text();
        const type = (file.name.split('.').pop() || 'text').toLowerCase();
        results.push({
          id: `${Date.now()}-${results.length}-${file.name}`,
          name: file.name,
          path: file.name,
          type,
          size: file.size,
          text: text.slice(0, MAX_ATTACHMENT_CHARS),
          preview: text.slice(0, 260)
        });
      } catch (error) {
        results.push({
          id: `${Date.now()}-${results.length}-${file.name}`,
          name: file.name,
          path: file.name,
          error: error.message || 'File read failed.'
        });
      }
    }

    if (Array.from(fileList).length > MAX_INGEST_FILES) {
      results.push({
        id: `${Date.now()}-file-limit`,
        name: 'File count limit',
        error: `Up to ${MAX_INGEST_FILES} files are supported at once.`
      });
    }

    return results;
  }

  function setWindowMode(mode) {
    windowMode = {
      ...windowMode,
      mode: mode === 'compact' ? 'compact' : 'expanded',
      revealed: mode !== 'compact'
    };
    emit('window-mode-changed', windowMode);
    return windowMode;
  }

  window.companion = {
    getActiveContext: async () => ({ title: '', checkedAt: null }),
    selectRegion: async () => {
      throw new Error('Screen region capture is only available in the desktop app.');
    },
    analyzeScreenshot: analyzeContext,
    analyzeContext,
    transcribeAudio,
    generateImage,
    ingestFiles: async () => {
      throw new Error('Native file paths are only available in the desktop app.');
    },
    ingestBrowserFiles,
    getSettings,
    saveSettings,
    getStartupSettings: async () => ({ openAtLogin: false }),
    setStartupEnabled: async () => ({ openAtLogin: false }),
    getLanShareStatus: async () => ({ enabled: false, port: 0, token: '', urls: [] }),
    setLanShareEnabled: async () => ({ enabled: false, port: 0, token: '', urls: [] }),
    selectWorkspaceRoot: async () => {
      throw new Error('Workspace file tools are only available in the desktop app.');
    },
    listModels,
    getWindowMode: async () => windowMode,
    setWindowMode: async (mode) => setWindowMode(mode),
    beginCompactDrag: async () => null,
    dragCompactWindow: async () => null,
    endCompactDrag: async () => null,
    revealCompactWindow: async () => {
      windowMode = { ...windowMode, revealed: true };
      emit('window-mode-changed', windowMode);
      return windowMode;
    },
    hideCompactTools: async () => {
      windowMode = { ...windowMode, revealed: false };
      emit('window-mode-changed', windowMode);
      return windowMode;
    },
    setAnswerZoom: async (enabled) => {
      windowMode = { ...windowMode, answerZoomed: Boolean(enabled), revealed: true };
      emit('window-mode-changed', windowMode);
      return windowMode;
    },
    minimizeWindow: async () => null,
    closeWindow: async () => null,
    togglePin: async () => false,
    getPathForFile: () => '',
    onContextUpdated: (callback) => listen('context-updated', callback),
    onWindowModeChanged: (callback) => listen('window-mode-changed', callback),
    onScreenshotCreated: (callback) => listen('screenshot-created', callback),
    onScreenshotError: (callback) => listen('screenshot-error', callback),
    onLanShareReceived: (callback) => listen('lan-share-received', callback),
    onUpdateStatus: (callback) => listen('update-status', callback)
  };
}());
