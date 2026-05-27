// @ts-nocheck
export function bootCompanionRenderer() {
const $ = (id) => document.getElementById(id);

const elements = {
  apiKeyInput: $('apiKeyInput'),
  baseUrlInput: $('baseUrlInput'),
  modelInput: $('modelInput'),
  modelCombo: $('modelCombo'),
  modelMenuButton: $('modelMenuButton'),
  modelMenu: $('modelMenu'),
  refreshModelsButton: $('refreshModelsButton'),
  imageApiKeyInput: $('imageApiKeyInput'),
  imageBaseUrlInput: $('imageBaseUrlInput'),
  imageModelInput: $('imageModelInput'),
  imageModelCombo: $('imageModelCombo'),
  imageModelMenuButton: $('imageModelMenuButton'),
  imageModelMenu: $('imageModelMenu'),
  imageRefreshModelsButton: $('imageRefreshModelsButton'),
  claudeApiKeyInput: $('claudeApiKeyInput'),
  claudeBaseUrlInput: $('claudeBaseUrlInput'),
  claudeModelInput: $('claudeModelInput'),
  claudeModelCombo: $('claudeModelCombo'),
  claudeModelMenuButton: $('claudeModelMenuButton'),
  claudeModelMenu: $('claudeModelMenu'),
  claudeRefreshModelsButton: $('claudeRefreshModelsButton'),
  localApiKeyInput: $('localApiKeyInput'),
  localBaseUrlInput: $('localBaseUrlInput'),
  localModelInput: $('localModelInput'),
  localModelCombo: $('localModelCombo'),
  localModelMenuButton: $('localModelMenuButton'),
  localModelMenu: $('localModelMenu'),
  localRefreshModelsButton: $('localRefreshModelsButton'),
  commandAccessToggle: $('commandAccessToggle'),
  workspaceRootInput: $('workspaceRootInput'),
  chooseWorkspaceButton: $('chooseWorkspaceButton'),
  clearWorkspaceButton: $('clearWorkspaceButton'),
  workspaceAccessStatus: $('workspaceAccessStatus'),
  startupLaunchToggle: $('startupLaunchToggle'),
  startupLaunchStatus: $('startupLaunchStatus'),
  lowCpuModeToggle: $('lowCpuModeToggle'),
  lanShareToggle: $('lanShareToggle'),
  lanShareStatus: $('lanShareStatus'),
  lanShareUrl: $('lanShareUrl'),
  guideBody: $('guideBody'),
  guideTabs: Array.from(document.querySelectorAll('[data-guide-lang]')),
  saveSettingsButton: $('saveSettingsButton'),
  settingsStatus: $('settingsStatus'),
  themeDarkButton: $('themeDarkButton'),
  themeLightButton: $('themeLightButton'),
  historyList: $('historyList'),
  clearHistoryButton: $('clearHistoryButton'),
  collapseButton: $('collapseButton'),
  pinButton: $('pinButton'),
  minimizeButton: $('minimizeButton'),
  closeButton: $('closeButton'),
  compactShell: $('compactShell'),
  agentIcon: $('agentIcon'),
  compactModelButton: $('compactModelButton'),
  compactShotButton: $('compactShotButton'),
  compactFileButton: $('compactFileButton'),
  compactMicButton: $('compactMicButton'),
  compactOpenButton: $('compactOpenButton'),
  compactExitButton: $('compactExitButton'),
  compactModelPanel: $('compactModelPanel'),
  compactPromptInput: $('compactPromptInput'),
  compactSendButton: $('compactSendButton'),
  compactHistoryButton: $('compactHistoryButton'),
  compactHistoryPanel: $('compactHistoryPanel'),
  compactAnswerExpandButton: $('compactAnswerExpandButton'),
  compactAnswerBox: $('compactAnswerBox'),
  compactContextStatus: $('compactContextStatus'),
  compactScreenshotStrip: $('compactScreenshotStrip'),
  compactScreenshotPreviewButton: $('compactScreenshotPreviewButton'),
  compactScreenshotThumb: $('compactScreenshotThumb'),
  compactScreenshotDeleteButton: $('compactScreenshotDeleteButton'),
  compactScreenshotPreviewPanel: $('compactScreenshotPreviewPanel'),
  compactScreenshotPreviewImage: $('compactScreenshotPreviewImage'),
  compactScreenshotPreviewDeleteButton: $('compactScreenshotPreviewDeleteButton'),
  compactScreenshotPreviewCloseButton: $('compactScreenshotPreviewCloseButton'),
  hiddenFileInput: $('hiddenFileInput')
};

const AUTO_COMPACT_AFTER_MS = 3000;
const AGENT_TAP_DELAY_MS = 165;
const AGENT_DOUBLE_TAP_MS = 360;
const HISTORY_KEY = 'companion.history.v2';
const GUIDE_LANGUAGE_KEY = 'companion.guide.language';
const VOICE_WAKE_PHRASE = 'hi cherry';
const VOICE_SEGMENT_MS = 3600;
const VOICE_RESTART_MS = 180;
const GUIDE_CONTENT = {
  zh: [
    ['快速提问', '单击悬浮图标展开问答框，输入问题后发送；双击图标打开主菜单。'],
    ['截图和文件', '用截图按钮选择屏幕区域，或拖入 PDF、DOCX、Markdown、代码文件，让 AI 结合内容回答。'],
    ['模型配置', '在接口区填写 API Key、接口地址和模型；本地模型可使用 Ollama / LM Studio 的 OpenAI-compatible 地址。'],
    ['工作文件夹', '选择工作文件夹即授权 AI 在该目录内读写、创建项目和打开文件。取消授权后 AI 不能继续访问该目录。'],
    ['命令和自启', '命令权限单独开启后才允许调试、构建和发布命令；开机自启会写入当前系统用户的登录项。']
  ],
  en: [
    ['Quick Ask', 'Click the floating icon to open the compact prompt, then type and send. Double-click the icon to open the main menu.'],
    ['Screenshots and Files', 'Use the screenshot button to select a screen area, or drop PDF, DOCX, Markdown, and source files for context-aware answers.'],
    ['Model Setup', 'Fill in the API key, base URL, and model. Local models can use an OpenAI-compatible Ollama or LM Studio endpoint.'],
    ['Workspace Folder', 'Choosing a workspace folder authorizes AI to read, write, create projects, and open files only inside that folder.'],
    ['Commands and Startup', 'Command access is separate and required for build, debug, and publish commands. Startup launch is registered for the current OS user.']
  ],
  ja: [
    ['クイック質問', 'フローティングアイコンをクリックすると質問欄が開きます。ダブルクリックするとメインメニューを開きます。'],
    ['スクリーンショットとファイル', '画面範囲を選択するか、PDF、DOCX、Markdown、コードファイルをドロップして、内容に基づく回答を得られます。'],
    ['モデル設定', 'API Key、接続先 URL、モデル名を入力します。ローカルモデルは Ollama / LM Studio の OpenAI 互換エンドポイントを使えます。'],
    ['作業フォルダー', '作業フォルダーを選択すると、その中だけで AI が読み書き、プロジェクト作成、ファイルを開く操作を行えます。'],
    ['コマンドと自動起動', 'ビルド、デバッグ、公開コマンドには別途コマンド権限が必要です。自動起動は現在の OS ユーザーに登録されます。']
  ]
};
const UI_TEXT = {
  zh: {
    lang: 'zh-CN',
    brandMode: '设置',
    interfaceTitle: '接口',
    waitingKey: '等待 API Key',
    configured: '接口 1 已配置',
    dark: '深色',
    light: '浅色',
    provider: '接口',
    providerMeta: 'Key / URL / 模型',
    apiKey: 'API Key',
    baseUrl: '接口地址',
    model: '模型',
    chooseModel: '选择模型',
    refreshModel: '刷新模型',
    localModel: '本地模型',
    localKeyPlaceholder: '本地服务通常留空',
    workspace: '工作文件夹',
    authorized: '已授权',
    unauthorized: '未授权',
    workspaceLabel: 'AI 可操作目录',
    workspacePlaceholder: '选择文件夹即授权 AI 在其中工作',
    workspaceAuthorizedStatus: '工作文件夹已授权',
    workspaceRevokedStatus: '工作文件夹授权已取消',
    chooseWorkspaceFailed: '选择目录失败',
    commandEnabledStatus: '命令权限已开启',
    commandDisabledStatus: '命令权限已关闭',
    chooseWorkspace: '选择并授权工作文件夹',
    clearWorkspace: '取消授权',
    commandAccess: '允许 AI 在该文件夹内运行调试、构建和发布命令',
    system: '系统',
    startup: '开机自启 CherryPilot',
    lowCpu: '低 CPU 模式',
    enabled: '已开启',
    disabled: '未开启',
    lanShare: '局域网共享',
    lanAllow: '允许同一局域网设备发送资料',
    lanUrlIdle: '开启后显示访问地址',
    lanNoAddress: '已开启，等待网络地址',
    guide: '使用说明',
    saveConfig: '保存配置',
    history: '历史询问',
    clear: '清空',
    prompt: '直接提问...',
    noContext: '无上下文',
    waitingQuestion: '等待提问',
    send: '发送',
    openMain: '打开主界面',
    screenshot: '区域截图',
    file: '文档',
    voice: '语音',
    switchModel: '切换模型',
    exit: '退出',
    collapse: '收起为图标',
    pin: '置顶',
    minimize: '最小化',
    close: '关闭',
    expand: '放大',
    modelEmpty: '刷新后选择模型',
    modelSelected: '{provider} 已选择模型',
    refreshingModels: '正在刷新 {provider} 模型',
    modelsFetched: '{provider} 已获取 {count} 个模型',
    noModels: '没有返回模型',
    modelRefreshFailed: '模型刷新失败',
    compactModelNeedConfig: '先在主页面配置接口 Key，然后刷新模型。',
    compactModelFetching: '正在拉取模型...',
    compactModelFetchFailed: '模型拉取失败，检查 Key 和接口地址。',
    providerSelectedModel: '{provider} 已选择 {model}',
    switchedModel: '已切换到 {provider} · {model}',
    saving: '保存中',
    saved: '已保存',
    saveFailed: '保存失败',
    startupReadFailed: '读取失败',
    startupEnabledStatus: '开机自启已开启',
    startupDisabledStatus: '开机自启已关闭',
    startupFailed: '开机自启设置失败',
    lanEnabledStatus: '局域网共享已开启',
    lanDisabledStatus: '局域网共享已关闭',
    lanFailed: '局域网共享失败',
    performanceUpdated: '性能设置已更新',
    lanReceived: '局域网收到 {success} 项。',
    lanReceivedPartial: '局域网收到 {success} 项，{failed} 项失败。',
    historyEmpty: '暂无历史记录',
    contextAnalysis: '基于上下文分析',
    historyQuestion: '历史问题',
    historyBack: '返回历史列表',
    historyExpand: '放大阅读',
    noAnswer: '没有回答内容',
    screenshotChip: '截图',
    fileCount: '{count} 文档',
    textOnly: '文本',
    screenshotSelecting: '等待选择截图区域...',
    screenshotFailed: '截图失败',
    screenshotReady: '截图已加入上下文，已打开预览。',
    screenshotPreview: '截图预览',
    deleteScreenshot: '删除截图',
    closePreview: '关闭预览',
    screenshotDeleted: '截图已删除，不会再作为上下文发送。',
    missingFilePath: '无法读取文件路径：{names}',
    readingFiles: '正在读取文档...',
    filesReadPartial: '已读取 {success} 个文档，{failed} 个失败。',
    filesReadReady: '已读取 {success} 个文档，可以直接提问。',
    filesReadFailed: '读取文档失败',
    needPromptOrContext: '先输入问题，或加入截图/文档。',
    thinking: '正在思考...',
    usingModel: '使用 {model}',
    analysisFailed: '分析失败',
    loadingConfigFailed: '读取配置失败',
    noVoiceCaptured: '没有收到语音',
    transcribingVoice: '正在识别语音...',
    voiceAdded: '语音已加入输入框',
    voiceFailed: '语音识别失败',
    voiceUnavailable: '当前环境不可用语音输入',
    recordingVoice: '正在录音，再点一次麦克风停止',
    microphoneDenied: '麦克风权限被拒绝',
    voiceStartFailed: '语音模式启动失败',
    waitingWake: '等待口令 "hi cherry"...',
    voiceAwake: '已唤醒，请继续说你要我做的事。',
    keepListening: '{message}\n\n继续监听 "hi cherry"...',
    imagePromptNeeded: '请说出要生成的画面内容。',
    imageGenerating: '正在生成图片...',
    imageGenerated: '已生成图片：{prompt}',
    imageFailed: '生图失败',
    voiceNeed: '已唤醒，请继续说需求。',
    voiceClosed: '语音模式已关闭',
    answeringVoice: '正在回答语音问题...'
  },
  en: {
    lang: 'en',
    brandMode: 'Settings',
    interfaceTitle: 'Interfaces',
    waitingKey: 'Waiting for API Key',
    configured: 'Interface 1 configured',
    dark: 'Dark',
    light: 'Light',
    provider: 'Interface',
    providerMeta: 'Key / URL / Model',
    apiKey: 'API Key',
    baseUrl: 'Base URL',
    model: 'Model',
    chooseModel: 'Choose model',
    refreshModel: 'Refresh models',
    localModel: 'Local model',
    localKeyPlaceholder: 'Usually blank for local services',
    workspace: 'Workspace Folder',
    authorized: 'Authorized',
    unauthorized: 'Unauthorized',
    workspaceLabel: 'AI-accessible folder',
    workspacePlaceholder: 'Choose a folder to authorize AI work',
    workspaceAuthorizedStatus: 'Workspace folder authorized',
    workspaceRevokedStatus: 'Workspace access revoked',
    chooseWorkspaceFailed: 'Folder selection failed',
    commandEnabledStatus: 'Command access enabled',
    commandDisabledStatus: 'Command access disabled',
    chooseWorkspace: 'Choose and authorize workspace',
    clearWorkspace: 'Revoke access',
    commandAccess: 'Allow AI to run debug, build, and publish commands in this folder',
    system: 'System',
    startup: 'Launch CherryPilot at startup',
    lowCpu: 'Low CPU mode',
    enabled: 'On',
    disabled: 'Off',
    lanShare: 'LAN Sharing',
    lanAllow: 'Allow devices on this LAN to send materials',
    lanUrlIdle: 'Enable to show the share address',
    lanNoAddress: 'Enabled, waiting for network address',
    guide: 'Guide',
    saveConfig: 'Save config',
    history: 'History',
    clear: 'Clear',
    prompt: 'Ask directly...',
    noContext: 'No context',
    waitingQuestion: 'Waiting for a question',
    send: 'Send',
    openMain: 'Open main panel',
    screenshot: 'Screenshot region',
    file: 'File',
    voice: 'Voice',
    switchModel: 'Switch model',
    exit: 'Exit',
    collapse: 'Collapse to icon',
    pin: 'Pin',
    minimize: 'Minimize',
    close: 'Close',
    expand: 'Expand',
    modelEmpty: 'Refresh to choose a model',
    modelSelected: '{provider} selected a model',
    refreshingModels: 'Refreshing {provider} models',
    modelsFetched: '{provider} fetched {count} model(s)',
    noModels: 'No models returned',
    modelRefreshFailed: 'Model refresh failed',
    compactModelNeedConfig: 'Configure an interface key on the main panel, then refresh models.',
    compactModelFetching: 'Fetching models...',
    compactModelFetchFailed: 'Model fetch failed. Check the key and base URL.',
    providerSelectedModel: '{provider} selected {model}',
    switchedModel: 'Switched to {provider} · {model}',
    saving: 'Saving',
    saved: 'Saved',
    saveFailed: 'Save failed',
    startupReadFailed: 'Read failed',
    startupEnabledStatus: 'Startup launch enabled',
    startupDisabledStatus: 'Startup launch disabled',
    startupFailed: 'Startup setting failed',
    lanEnabledStatus: 'LAN sharing enabled',
    lanDisabledStatus: 'LAN sharing disabled',
    lanFailed: 'LAN sharing failed',
    performanceUpdated: 'Performance setting updated',
    lanReceived: 'LAN received {success} item(s).',
    lanReceivedPartial: 'LAN received {success} item(s), {failed} failed.',
    historyEmpty: 'No history yet',
    contextAnalysis: 'Context analysis',
    historyQuestion: 'History question',
    historyBack: 'Back to history',
    historyExpand: 'Expand reading',
    noAnswer: 'No answer content',
    screenshotChip: 'Screenshot',
    fileCount: '{count} file(s)',
    textOnly: 'Text',
    screenshotSelecting: 'Waiting for screenshot region...',
    screenshotFailed: 'Screenshot failed',
    screenshotReady: 'Screenshot added to context. Preview opened.',
    screenshotPreview: 'Screenshot preview',
    deleteScreenshot: 'Delete screenshot',
    closePreview: 'Close preview',
    screenshotDeleted: 'Screenshot deleted. It will not be sent as context.',
    missingFilePath: 'Cannot read file path: {names}',
    readingFiles: 'Reading files...',
    filesReadPartial: 'Read {success} file(s), {failed} failed.',
    filesReadReady: 'Read {success} file(s). Ask directly.',
    filesReadFailed: 'File read failed',
    needPromptOrContext: 'Enter a question or add a screenshot/file.',
    thinking: 'Thinking...',
    usingModel: 'Using {model}',
    analysisFailed: 'Analysis failed',
    loadingConfigFailed: 'Config read failed',
    noVoiceCaptured: 'No voice captured',
    transcribingVoice: 'Transcribing voice...',
    voiceAdded: 'Voice added to input',
    voiceFailed: 'Voice transcription failed',
    voiceUnavailable: 'Voice input is not available in this environment',
    recordingVoice: 'Recording... click mic again to stop',
    microphoneDenied: 'Microphone permission denied',
    voiceStartFailed: 'Voice mode failed to start',
    waitingWake: 'Waiting for "hi cherry"...',
    voiceAwake: 'Awake. Keep speaking your request.',
    keepListening: '{message}\n\nStill listening for "hi cherry"...',
    imagePromptNeeded: 'Say what image you want to generate.',
    imageGenerating: 'Generating image...',
    imageGenerated: 'Generated image: {prompt}',
    imageFailed: 'Image generation failed',
    voiceNeed: 'Awake. Continue with your request.',
    voiceClosed: 'Voice mode closed',
    answeringVoice: 'Answering voice question...'
  },
  ja: {
    lang: 'ja',
    brandMode: '設定',
    interfaceTitle: '接続設定',
    waitingKey: 'API Key 待ち',
    configured: '接続 1 設定済み',
    dark: 'ダーク',
    light: 'ライト',
    provider: '接続',
    providerMeta: 'Key / URL / モデル',
    apiKey: 'API Key',
    baseUrl: '接続先 URL',
    model: 'モデル',
    chooseModel: 'モデルを選択',
    refreshModel: 'モデルを更新',
    localModel: 'ローカルモデル',
    localKeyPlaceholder: 'ローカルサービスでは通常空欄',
    workspace: '作業フォルダー',
    authorized: '許可済み',
    unauthorized: '未許可',
    workspaceLabel: 'AI が操作できるフォルダー',
    workspacePlaceholder: 'フォルダーを選択して AI 作業を許可',
    workspaceAuthorizedStatus: '作業フォルダーを許可しました',
    workspaceRevokedStatus: '作業フォルダーの許可を取り消しました',
    chooseWorkspaceFailed: 'フォルダー選択に失敗しました',
    commandEnabledStatus: 'コマンド権限を有効にしました',
    commandDisabledStatus: 'コマンド権限を無効にしました',
    chooseWorkspace: '作業フォルダーを選択して許可',
    clearWorkspace: '許可を取り消す',
    commandAccess: 'このフォルダー内でデバッグ、ビルド、公開コマンドの実行を許可',
    system: 'システム',
    startup: '起動時に CherryPilot を開始',
    lowCpu: '低 CPU モード',
    enabled: 'オン',
    disabled: 'オフ',
    lanShare: 'LAN 共有',
    lanAllow: '同じ LAN の端末から資料送信を許可',
    lanUrlIdle: '有効にすると共有アドレスを表示',
    lanNoAddress: '有効、ネットワークアドレス待ち',
    guide: '使い方',
    saveConfig: '設定を保存',
    history: '履歴',
    clear: '消去',
    prompt: '質問を入力...',
    noContext: 'コンテキストなし',
    waitingQuestion: '質問待ち',
    send: '送信',
    openMain: 'メイン画面を開く',
    screenshot: '範囲スクリーンショット',
    file: 'ファイル',
    voice: '音声',
    switchModel: 'モデル切替',
    exit: '終了',
    collapse: 'アイコンに戻す',
    pin: '最前面',
    minimize: '最小化',
    close: '閉じる',
    expand: '拡大',
    modelEmpty: '更新後にモデルを選択',
    modelSelected: '{provider} のモデルを選択しました',
    refreshingModels: '{provider} のモデルを更新中',
    modelsFetched: '{provider} で {count} 件のモデルを取得',
    noModels: 'モデルが返されませんでした',
    modelRefreshFailed: 'モデル更新に失敗しました',
    compactModelNeedConfig: 'メイン画面で接続 Key を設定し、モデルを更新してください。',
    compactModelFetching: 'モデルを取得中...',
    compactModelFetchFailed: 'モデル取得に失敗しました。Key と接続先 URL を確認してください。',
    providerSelectedModel: '{provider} で {model} を選択しました',
    switchedModel: '{provider} · {model} に切り替えました',
    saving: '保存中',
    saved: '保存しました',
    saveFailed: '保存に失敗しました',
    startupReadFailed: '読み取り失敗',
    startupEnabledStatus: '自動起動を有効にしました',
    startupDisabledStatus: '自動起動を無効にしました',
    startupFailed: '自動起動設定に失敗しました',
    lanEnabledStatus: 'LAN 共有を有効にしました',
    lanDisabledStatus: 'LAN 共有を無効にしました',
    lanFailed: 'LAN 共有に失敗しました',
    performanceUpdated: 'パフォーマンス設定を更新しました',
    lanReceived: 'LAN から {success} 件受信しました。',
    lanReceivedPartial: 'LAN から {success} 件受信、{failed} 件失敗しました。',
    historyEmpty: '履歴はまだありません',
    contextAnalysis: 'コンテキスト分析',
    historyQuestion: '履歴の質問',
    historyBack: '履歴一覧に戻る',
    historyExpand: '拡大して読む',
    noAnswer: '回答内容がありません',
    screenshotChip: 'スクリーンショット',
    fileCount: '{count} ファイル',
    textOnly: 'テキスト',
    screenshotSelecting: '範囲選択を待っています...',
    screenshotFailed: 'スクリーンショットに失敗しました',
    screenshotReady: 'スクリーンショットをコンテキストに追加し、プレビューを開きました。',
    screenshotPreview: 'スクリーンショットのプレビュー',
    deleteScreenshot: 'スクリーンショットを削除',
    closePreview: 'プレビューを閉じる',
    screenshotDeleted: 'スクリーンショットを削除しました。コンテキストには送信されません。',
    missingFilePath: 'ファイルパスを読み取れません: {names}',
    readingFiles: 'ファイルを読み取り中...',
    filesReadPartial: '{success} 件読み取り、{failed} 件失敗しました。',
    filesReadReady: '{success} 件読み取りました。質問できます。',
    filesReadFailed: 'ファイル読み取りに失敗しました',
    needPromptOrContext: '質問を入力するか、スクリーンショット/ファイルを追加してください。',
    thinking: '考えています...',
    usingModel: '{model} を使用',
    analysisFailed: '分析に失敗しました',
    loadingConfigFailed: '設定の読み取りに失敗しました',
    noVoiceCaptured: '音声がありません',
    transcribingVoice: '音声を認識中...',
    voiceAdded: '音声を入力欄に追加しました',
    voiceFailed: '音声認識に失敗しました',
    voiceUnavailable: 'この環境では音声入力を使えません',
    recordingVoice: '録音中。もう一度マイクを押すと停止します',
    microphoneDenied: 'マイク権限が拒否されました',
    voiceStartFailed: '音声モードの起動に失敗しました',
    waitingWake: '"hi cherry" の合言葉を待っています...',
    voiceAwake: '起動しました。続けて依頼を話してください。',
    keepListening: '{message}\n\n"hi cherry" を引き続き待っています...',
    imagePromptNeeded: '生成したい画像の内容を話してください。',
    imageGenerating: '画像を生成中...',
    imageGenerated: '画像を生成しました：{prompt}',
    imageFailed: '画像生成に失敗しました',
    voiceNeed: '起動しました。依頼を続けてください。',
    voiceClosed: '音声モードを閉じました',
    answeringVoice: '音声質問に回答中...'
  }
};
const PROVIDERS = [
  { id: 'chat', label: '接口 1', defaultBaseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o-mini' },
  { id: 'slot2', label: '接口 2', defaultBaseUrl: 'https://api.openai.com/v1', defaultModel: '' },
  { id: 'slot3', label: '接口 3', defaultBaseUrl: 'https://api.openai.com/v1', defaultModel: '' }
];

PROVIDERS.push({
  id: 'local',
  label: '本地模型',
  defaultBaseUrl: 'http://127.0.0.1:11434/v1',
  defaultModel: '',
  local: true
});
const LAST_PROVIDER_INDEX = PROVIDERS.length - 1;

const state = {
  activeContext: { title: '', checkedAt: null },
  screenshotDataUrl: '',
  attachments: [],
  modelLists: PROVIDERS.map(() => []),
  activeProviderIndex: 0,
  history: [],
  selectedHistoryId: '',
  theme: 'dark',
  guideLanguage: localStorage.getItem(GUIDE_LANGUAGE_KEY) || 'zh',
  lowCpuMode: true,
  lanShare: { enabled: false, urls: [] },
  isRecording: false,
  mediaRecorder: null,
  voiceStream: null,
  voiceChunks: [],
  voiceAwake: false,
  voiceSegmentTimer: null,
  voiceRestartTimer: null,
  voiceMimeType: '',
  windowMode: 'expanded',
  answerZoomed: false,
  isBusy: false,
  pointerInWindow: false,
  compactDrag: null,
  compactDragFrame: null,
  compactDragPoint: null,
  agentTapTimer: null,
  lastAgentTapAt: 0,
  dragDepth: 0,
  autoCompactTimer: null,
  mainLockedOpen: true
};

const providerSlots = [
  {
    ...PROVIDERS[0],
    apiKeyInput: elements.apiKeyInput,
    baseUrlInput: elements.baseUrlInput,
    modelInput: elements.modelInput,
    modelCombo: elements.modelCombo,
    modelMenuButton: elements.modelMenuButton,
    modelMenu: elements.modelMenu,
    refreshButton: elements.refreshModelsButton
  },
  {
    ...PROVIDERS[1],
    apiKeyInput: elements.imageApiKeyInput,
    baseUrlInput: elements.imageBaseUrlInput,
    modelInput: elements.imageModelInput,
    modelCombo: elements.imageModelCombo,
    modelMenuButton: elements.imageModelMenuButton,
    modelMenu: elements.imageModelMenu,
    refreshButton: elements.imageRefreshModelsButton
  },
  {
    ...PROVIDERS[2],
    apiKeyInput: elements.claudeApiKeyInput,
    baseUrlInput: elements.claudeBaseUrlInput,
    modelInput: elements.claudeModelInput,
    modelCombo: elements.claudeModelCombo,
    modelMenuButton: elements.claudeModelMenuButton,
    modelMenu: elements.claudeModelMenu,
    refreshButton: elements.claudeRefreshModelsButton
  },
  {
    ...PROVIDERS[3],
    apiKeyInput: elements.localApiKeyInput,
    baseUrlInput: elements.localBaseUrlInput,
    modelInput: elements.localModelInput,
    modelCombo: elements.localModelCombo,
    modelMenuButton: elements.localModelMenuButton,
    modelMenu: elements.localModelMenu,
    refreshButton: elements.localRefreshModelsButton
  }
];

const compactTooltips = [
  [elements.compactModelButton, '切换模型'],
  [elements.compactShotButton, '区域截屏'],
  [elements.compactFileButton, '文档'],
  [elements.compactMicButton, '语音'],
  [elements.compactOpenButton, '主界面'],
  [elements.compactExitButton, '退出']
];

for (const [button, label] of compactTooltips) {
  if (button) {
    button.dataset.tooltip = label;
    button.title = label;
  }
}

if (elements.compactMicButton) {
  elements.compactMicButton.dataset.tooltip = 'Voice: hi cherry';
  elements.compactMicButton.title = 'Voice: hi cherry';
}

const saveSettingsLabel = elements.saveSettingsButton?.querySelector('[data-button-label]');
if (saveSettingsLabel) {
  saveSettingsLabel.textContent = textFor('saveConfig');
}

function formatTime(value) {
  if (!value) {
    return '--';
  }

  return new Intl.DateTimeFormat((UI_TEXT[state.guideLanguage] || UI_TEXT.zh).lang, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

function setBusy(value) {
  state.isBusy = value;
  document.body.dataset.busy = value ? 'true' : 'false';
  elements.compactSendButton.disabled = value;
}

function setButtonBusy(button, busy, label) {
  if (!button) {
    return;
  }

  button.disabled = busy;
  button.classList.toggle('is-loading', busy);

  const labelEl = button.querySelector('[data-button-label]');
  if (!labelEl) {
    return;
  }

  if (busy) {
    labelEl.textContent = label;
    return;
  }

  labelEl.textContent = textFor('saveConfig');
}

function setCompactAnswer(content, pending = false) {
  elements.compactAnswerBox.textContent = content || textFor('waitingQuestion');
  elements.compactAnswerBox.classList.toggle('is-pending', pending);
}

function setCompactAnswer(content, pending = false, imageUrl = '') {
  elements.compactAnswerBox.textContent = '';

  const text = document.createElement('div');
  text.className = 'compact-answer-text';
  text.textContent = content || textFor('waitingQuestion');
  elements.compactAnswerBox.appendChild(text);

  if (imageUrl) {
    const image = document.createElement('img');
    image.className = 'compact-generated-image';
    image.src = imageUrl;
    image.alt = content || 'Generated image';
    elements.compactAnswerBox.appendChild(image);
  }

  elements.compactAnswerBox.classList.toggle('is-pending', pending);
}

function closeScreenshotPreview() {
  if (elements.compactScreenshotPreviewPanel) {
    elements.compactScreenshotPreviewPanel.hidden = true;
  }
  elements.compactScreenshotPreviewButton?.classList.remove('is-active');
}

function renderScreenshotContext() {
  const hasScreenshot = Boolean(state.screenshotDataUrl);
  document.body.dataset.hasScreenshot = hasScreenshot ? 'true' : 'false';

  if (elements.compactScreenshotStrip) {
    elements.compactScreenshotStrip.hidden = !hasScreenshot;
  }

  if (elements.compactScreenshotThumb) {
    if (hasScreenshot) {
      elements.compactScreenshotThumb.src = state.screenshotDataUrl;
    } else {
      elements.compactScreenshotThumb.removeAttribute('src');
    }
    elements.compactScreenshotThumb.alt = textFor('screenshotPreview');
  }

  if (elements.compactScreenshotPreviewImage) {
    if (hasScreenshot) {
      elements.compactScreenshotPreviewImage.src = state.screenshotDataUrl;
    } else {
      elements.compactScreenshotPreviewImage.removeAttribute('src');
    }
    elements.compactScreenshotPreviewImage.alt = textFor('screenshotPreview');
  }

  if (!hasScreenshot) {
    closeScreenshotPreview();
  }
}

function openScreenshotPreview(event) {
  event?.preventDefault?.();
  event?.stopPropagation?.();

  if (!state.screenshotDataUrl || !elements.compactScreenshotPreviewPanel) {
    return;
  }

  closeCompactModelPanel();
  closeCompactHistoryPanel();
  elements.compactScreenshotPreviewPanel.hidden = false;
  elements.compactScreenshotPreviewButton?.classList.add('is-active');
}

function clearScreenshot(event) {
  event?.preventDefault?.();
  event?.stopPropagation?.();

  if (!state.screenshotDataUrl) {
    return;
  }

  state.screenshotDataUrl = '';
  renderScreenshotContext();
  updateContextStatus();
  setCompactAnswer(textFor('screenshotDeleted'));
  elements.compactPromptInput?.focus();
}

function updateContextStatus() {
  if (!elements.compactContextStatus) {
    return;
  }

  const parts = [];
  if (state.screenshotDataUrl) {
    parts.push(textFor('screenshot'));
  }

  const validAttachments = state.attachments.filter((item) => item.text && !item.error);
  if (validAttachments.length > 0) {
    parts.push(`${validAttachments.length} ${textFor('file')}`);
  }

  elements.compactContextStatus.textContent = parts.length > 0 ? parts.join(' · ') : textFor('noContext');
}

function loadHistory() {
  try {
    const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    state.history = Array.isArray(parsed) ? parsed.slice(0, 50) : [];
  } catch {
    state.history = [];
  }
}

function saveHistory() {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(state.history.slice(0, 50)));
}

function addHistory(entry) {
  state.history.unshift({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    askedAt: new Date().toISOString(),
    ...entry
  });
  state.history = state.history.slice(0, 50);
  saveHistory();
  renderHistory();
}

function renderHistory() {
  elements.historyList.textContent = '';
  elements.clearHistoryButton.disabled = state.history.length === 0;

  const selected = state.history.find((item) => item.id === state.selectedHistoryId);
  if (selected) {
    renderHistoryDetail(selected);
    return;
  }

  if (state.history.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'history-empty';
    empty.textContent = textFor('historyEmpty');
    elements.historyList.appendChild(empty);
    return;
  }

  for (const item of state.history) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'history-item';

    const head = document.createElement('div');
    head.className = 'history-head';

    const question = document.createElement('strong');
    question.textContent = item.question || textFor('contextAnalysis');

    const time = document.createElement('span');
    time.textContent = formatTime(item.askedAt);

    head.append(question, time);

    const answer = document.createElement('p');
    answer.textContent = item.answer || '';

    const meta = document.createElement('small');
    const chips = [];
    if (item.hasImage) {
      chips.push(textFor('screenshotChip'));
    }
    if (item.attachmentCount) {
      chips.push(formatText('fileCount', { count: item.attachmentCount }));
    }
    if (item.model) {
      chips.push(item.model);
    }
    meta.textContent = chips.join(' · ') || textFor('textOnly');

    row.append(head, meta);
    row.addEventListener('click', () => {
      state.selectedHistoryId = item.id;
      renderHistory();
    });
    elements.historyList.appendChild(row);
  }
}

function getHistoryAnswerText(item) {
  return [
    item.question || textFor('historyQuestion'),
    '',
    item.answer || ''
  ].join('\n');
}

async function openHistoryInAnswer(item, zoom = false) {
  setCompactAnswer(getHistoryAnswerText(item), false, item.imageUrl || '');
  elements.compactPromptInput.value = item.question || '';
  closeCompactHistoryPanel();

  if (zoom) {
    const modeState = await window.companion.setAnswerZoom(true);
    applyWindowMode(modeState);
  } else {
    elements.compactPromptInput.focus();
  }
}

function renderHistoryDetail(item) {
  const detail = document.createElement('div');
  detail.className = 'history-detail';

  const header = document.createElement('div');
  header.className = 'history-detail-head';

  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'history-icon-button';
  back.title = textFor('historyBack');
  back.setAttribute('aria-label', textFor('historyBack'));
  back.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>';
  back.addEventListener('click', () => {
    state.selectedHistoryId = '';
    renderHistory();
  });

  const title = document.createElement('strong');
  title.textContent = item.question || textFor('historyQuestion');

  const expand = document.createElement('button');
  expand.type = 'button';
  expand.className = 'history-icon-button';
  expand.title = textFor('historyExpand');
  expand.setAttribute('aria-label', textFor('historyExpand'));
  expand.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5M16 21h5v-5M3 3l7 7M21 21l-7-7" /></svg>';
  expand.addEventListener('click', () => openHistoryInAnswer(item, true));

  header.append(back, title, expand);

  const answer = document.createElement('div');
  answer.className = 'history-detail-answer';
  answer.textContent = item.answer || textFor('noAnswer');

  const meta = document.createElement('small');
  const chips = [formatTime(item.askedAt)];
  if (item.model) {
    chips.push(item.model);
  }
  if (item.hasImage) {
    chips.push(textFor('screenshotChip'));
  }
  if (item.attachmentCount) {
    chips.push(formatText('fileCount', { count: item.attachmentCount }));
  }
  meta.textContent = chips.filter(Boolean).join(' · ');

  detail.append(header, answer, meta);
  elements.historyList.appendChild(detail);
}

function closeCompactHistoryPanel() {
  if (!elements.compactHistoryPanel) {
    return;
  }

  state.selectedHistoryId = '';
  elements.compactHistoryPanel.hidden = true;
  elements.compactHistoryButton?.classList.remove('is-active');
}

function toggleCompactHistoryPanel(event) {
  event?.preventDefault?.();
  event?.stopPropagation?.();

  if (!elements.compactHistoryPanel) {
    return;
  }

  if (!elements.compactHistoryPanel.hidden) {
    closeCompactHistoryPanel();
    return;
  }

  closeCompactModelPanel();
  closeScreenshotPreview();
  elements.compactHistoryPanel.hidden = false;
  elements.compactHistoryButton?.classList.add('is-active');
  renderHistory();
}

function clearAutoCompact() {
  clearTimeout(state.autoCompactTimer);
  state.autoCompactTimer = null;
}

function scheduleAutoCompact() {
  clearAutoCompact();

  if (state.windowMode !== 'expanded' || state.pointerInWindow || state.mainLockedOpen) {
    return;
  }

  state.autoCompactTimer = setTimeout(async () => {
    if (state.pointerInWindow || state.mainLockedOpen || state.isBusy || providerSlots.some((slot) => slot.modelCombo.classList.contains('is-open'))) {
      scheduleAutoCompact();
      return;
    }

    await window.companion.setWindowMode('compact');
  }, AUTO_COMPACT_AFTER_MS);
}

function applyWindowMode(nextState) {
  const modeState = typeof nextState === 'string' ? { mode: nextState } : nextState;
  state.windowMode = modeState.mode || 'expanded';
  state.answerZoomed = Boolean(modeState.answerZoomed);

  document.body.dataset.mode = state.windowMode;
  document.body.dataset.dockSide = modeState.dockSide || 'right';
  document.body.dataset.revealed = modeState.revealed ? 'true' : 'false';
  document.body.dataset.docked = modeState.docked ? 'true' : 'false';
  document.body.dataset.answerZoomed = state.answerZoomed ? 'true' : 'false';
  elements.compactAnswerExpandButton?.classList.toggle('is-active', state.answerZoomed);

  if (state.windowMode === 'compact') {
    state.mainLockedOpen = false;
    clearAutoCompact();
    closeModelMenu();
    return;
  }

  if (!state.pointerInWindow) {
    scheduleAutoCompact();
  }
}

async function loadContext() {
  state.activeContext = await window.companion.getActiveContext();
}

function applyTheme(theme) {
  state.theme = theme === 'light' ? 'light' : 'dark';
  document.body.dataset.theme = state.theme;
  elements.themeDarkButton.classList.toggle('is-active', state.theme === 'dark');
  elements.themeLightButton.classList.toggle('is-active', state.theme === 'light');
}

function getProviderValues() {
  return providerSlots.map((slot) => ({
    id: slot.id,
    label: slot.label,
    apiKey: slot.apiKeyInput.value,
    baseUrl: slot.baseUrlInput.value,
    model: slot.modelInput.value
  }));
}

function getComputerAccessValues() {
  const workspaceRoot = (elements.workspaceRootInput?.value || '').trim();

  return {
    enabled: Boolean(workspaceRoot),
    workspaceRoot,
    allowCommands: Boolean(workspaceRoot && elements.commandAccessToggle?.checked)
  };
}

function getPerformanceValues() {
  return {
    lowCpuMode: elements.lowCpuModeToggle?.checked !== false
  };
}

function getLanShareValues() {
  return {
    enabled: Boolean(state.lanShare?.enabled),
    port: Number(state.lanShare?.port || 0) || 0,
    token: state.lanShare?.token || ''
  };
}

function buildSettingsPayload() {
  return {
    theme: state.theme,
    activeProviderIndex: state.activeProviderIndex,
    providers: getProviderValues(),
    computerAccess: getComputerAccessValues(),
    performance: getPerformanceValues(),
    lanShare: getLanShareValues()
  };
}

function applyProviderValues(settings = {}) {
  const providers = Array.isArray(settings.providers) ? settings.providers : [];
  state.activeProviderIndex = Math.min(LAST_PROVIDER_INDEX, Math.max(0, Number(settings.activeProviderIndex || 0)));

  providerSlots.forEach((slot, index) => {
    const provider = providers[index] || {};
    slot.apiKeyInput.value = provider.apiKey || (index === 0 ? settings.apiKey || '' : '');
    slot.baseUrlInput.value = provider.baseUrl || (index === 0 ? settings.baseUrl : '') || slot.defaultBaseUrl;
    slot.modelInput.value = provider.model || (index === 0 ? settings.model : '') || slot.defaultModel;
  });
}

function applyComputerAccessValues(settings = {}) {
  const access = settings.computerAccess || {};
  const enabled = Boolean(access.enabled && access.workspaceRoot);
  const workspaceRoot = enabled ? access.workspaceRoot : '';

  if (elements.workspaceRootInput) {
    elements.workspaceRootInput.value = workspaceRoot;
  }

  if (elements.workspaceAccessStatus) {
    elements.workspaceAccessStatus.textContent = enabled ? textFor('authorized') : textFor('unauthorized');
  }

  if (elements.clearWorkspaceButton) {
    elements.clearWorkspaceButton.disabled = !enabled;
  }

  if (elements.commandAccessToggle) {
    elements.commandAccessToggle.checked = Boolean(access.allowCommands && enabled);
    elements.commandAccessToggle.disabled = !enabled;
  }
}

function applyPerformanceValues(settings = {}) {
  const performance = settings.performance || {};
  state.lowCpuMode = performance.lowCpuMode !== false;

  if (elements.lowCpuModeToggle) {
    elements.lowCpuModeToggle.checked = state.lowCpuMode;
  }
}

function textFor(key) {
  const language = UI_TEXT[state.guideLanguage] ? state.guideLanguage : 'zh';
  return UI_TEXT[language][key] || UI_TEXT.zh[key] || key;
}

function formatText(key, values = {}) {
  return textFor(key).replace(/\{(\w+)\}/g, (_match, name) => (
    Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : ''
  ));
}

function providerDisplayName(slotIndex) {
  const slot = providerSlots[slotIndex];
  if (slot?.local) {
    return textFor('localModel');
  }

  return `${String(slotIndex + 1).padStart(2, '0')} ${textFor('provider')}`;
}

function setText(target, value) {
  if (target) {
    target.textContent = value;
  }
}

function setTitle(target, value) {
  if (target) {
    target.title = value;
    target.setAttribute('aria-label', value);
    target.dataset.tooltip = value;
  }
}

function applyLocale() {
  const locale = UI_TEXT[state.guideLanguage] || UI_TEXT.zh;
  document.documentElement.lang = locale.lang;

  setText(document.querySelector('.brand-copy span'), locale.brandMode);
  setText(document.querySelector('.settings-panel > .panel-row h2'), locale.interfaceTitle);
  setText(elements.themeDarkButton, locale.dark);
  setText(elements.themeLightButton, locale.light);
  elements.compactPromptInput.placeholder = locale.prompt;

  if (elements.compactAnswerBox.textContent === UI_TEXT.zh.waitingQuestion
    || elements.compactAnswerBox.textContent === UI_TEXT.en.waitingQuestion
    || elements.compactAnswerBox.textContent === UI_TEXT.ja.waitingQuestion) {
    elements.compactAnswerBox.textContent = locale.waitingQuestion;
  }

  providerSlots.forEach((slot, index) => {
    const card = document.querySelector(`[data-provider="${index}"]`);
    const head = card?.querySelector('.provider-head');
    setText(head?.querySelector('strong'), slot.local ? locale.localModel : `${String(index + 1).padStart(2, '0')} ${locale.provider}`);
    setText(head?.querySelector('span'), slot.local ? 'Ollama / LM Studio' : locale.providerMeta);
    const labels = card ? Array.from(card.querySelectorAll('.field > span')) : [];
    setText(labels[0], locale.apiKey);
    setText(labels[1], locale.baseUrl);
    setText(labels[2], locale.model);
    setTitle(slot.modelMenuButton, locale.chooseModel);
    setTitle(slot.refreshButton, slot.local ? locale.refreshModel : locale.refreshModel);
    if (slot.local) {
      slot.apiKeyInput.placeholder = locale.localKeyPlaceholder;
    }
  });

  setTitle(elements.compactModelButton, locale.switchModel);
  setTitle(elements.compactShotButton, locale.screenshot);
  setTitle(elements.compactFileButton, locale.file);
  setTitle(elements.compactMicButton, locale.voice);
  setTitle(elements.compactOpenButton, locale.openMain);
  setTitle(elements.compactExitButton, locale.exit);
  setTitle(elements.compactSendButton, locale.send);
  setTitle(elements.compactScreenshotPreviewButton, locale.screenshotPreview);
  setTitle(elements.compactScreenshotDeleteButton, locale.deleteScreenshot);
  setTitle(elements.compactScreenshotPreviewDeleteButton, locale.deleteScreenshot);
  setTitle(elements.compactScreenshotPreviewCloseButton, locale.closePreview);
  setTitle(elements.collapseButton, locale.collapse);
  setTitle(elements.pinButton, locale.pin);
  setTitle(elements.minimizeButton, locale.minimize);
  setTitle(elements.closeButton, locale.close);
  setTitle(elements.compactAnswerExpandButton, locale.historyExpand);

  setText(document.querySelector('.permission-card .provider-head strong'), locale.workspace);
  setText(document.querySelector('.permission-card .field > span'), locale.workspaceLabel);
  elements.workspaceRootInput.placeholder = locale.workspacePlaceholder;
  setTitle(elements.chooseWorkspaceButton, locale.chooseWorkspace);
  setText(elements.clearWorkspaceButton, locale.clearWorkspace);
  setText(document.querySelector('.permission-card .permission-toggle span'), locale.commandAccess);

  setText(document.querySelector('.system-card .provider-head strong'), locale.system);
  setText(document.querySelector('.system-card .permission-toggle:nth-of-type(1) span'), locale.startup);
  setText(document.querySelector('.system-card .permission-toggle:nth-of-type(2) span'), locale.lowCpu);

  setText(document.querySelector('.lan-card .provider-head strong'), locale.lanShare);
  setText(document.querySelector('.lan-card .permission-toggle span'), locale.lanAllow);
  if (!state.lanShare.enabled && elements.lanShareUrl) {
    elements.lanShareUrl.textContent = locale.lanUrlIdle;
  }

  setText(document.querySelector('.guide-card .provider-head strong'), locale.guide);
  setText(saveSettingsLabel, locale.saveConfig);
  setText(document.querySelector('.main-history-panel .panel-row h2'), locale.history);
  document.querySelectorAll('#clearHistoryButton span').forEach((item) => setText(item, locale.clear));
  setText(elements.compactScreenshotPreviewButton?.querySelector('span'), locale.screenshotChip);
  setText(elements.compactScreenshotPreviewPanel?.querySelector('strong'), locale.screenshotPreview);
  setTitle(elements.compactHistoryButton, locale.history);

  applyComputerAccessValues({ computerAccess: getComputerAccessValues() });
  applyStartupSettings({ openAtLogin: Boolean(elements.startupLaunchToggle?.checked) });
  applyLanShareStatus(state.lanShare);
  providerSlots.forEach((slot, index) => {
    if (slot.modelCombo.classList.contains('is-open')) {
      renderModelMenu(index);
    }
  });
  if (elements.compactModelPanel && !elements.compactModelPanel.hidden) {
    renderCompactModelPanel();
  }
  renderHistory();
  updateContextStatus();
  renderScreenshotContext();
}

function renderGuide(language = state.guideLanguage) {
  const guideLanguage = GUIDE_CONTENT[language] ? language : 'zh';
  state.guideLanguage = guideLanguage;
  localStorage.setItem(GUIDE_LANGUAGE_KEY, guideLanguage);
  applyLocale();

  for (const tab of elements.guideTabs) {
    tab.classList.toggle('is-active', tab.dataset.guideLang === guideLanguage);
  }

  if (!elements.guideBody) {
    return;
  }

  elements.guideBody.textContent = '';

  for (const [title, text] of GUIDE_CONTENT[guideLanguage]) {
    const item = document.createElement('div');
    item.className = 'guide-item';

    const heading = document.createElement('strong');
    heading.textContent = title;

    const body = document.createElement('p');
    body.textContent = text;

    item.append(heading, body);
    elements.guideBody.appendChild(item);
  }
}

function applyStartupSettings(settings = {}) {
  const enabled = Boolean(settings.openAtLogin);

  if (elements.startupLaunchToggle) {
    elements.startupLaunchToggle.checked = enabled;
  }

  if (elements.startupLaunchStatus) {
    elements.startupLaunchStatus.textContent = enabled ? textFor('enabled') : textFor('disabled');
  }
}

async function loadStartupSettings() {
  try {
    const settings = await window.companion.getStartupSettings();
    applyStartupSettings(settings);
  } catch (error) {
    if (elements.startupLaunchStatus) {
      elements.startupLaunchStatus.textContent = textFor('startupReadFailed');
    }
  }
}

async function toggleStartupLaunch() {
  const enabled = Boolean(elements.startupLaunchToggle?.checked);

  if (elements.startupLaunchToggle) {
    elements.startupLaunchToggle.disabled = true;
  }

  try {
    const settings = await window.companion.setStartupEnabled(enabled);
    applyStartupSettings(settings);
    elements.settingsStatus.textContent = settings.openAtLogin ? textFor('startupEnabledStatus') : textFor('startupDisabledStatus');
  } catch (error) {
    await loadStartupSettings();
    elements.settingsStatus.textContent = error.message || textFor('startupFailed');
  } finally {
    if (elements.startupLaunchToggle) {
      elements.startupLaunchToggle.disabled = false;
    }
  }
}

function applyLanShareStatus(status = {}) {
  state.lanShare = {
    enabled: Boolean(status.enabled),
    port: Number(status.port || 0) || 0,
    token: status.token || '',
    urls: Array.isArray(status.urls) ? status.urls : []
  };

  if (elements.lanShareToggle) {
    elements.lanShareToggle.checked = state.lanShare.enabled;
  }

  if (elements.lanShareStatus) {
    elements.lanShareStatus.textContent = state.lanShare.enabled ? textFor('enabled') : textFor('disabled');
  }

  if (elements.lanShareUrl) {
    elements.lanShareUrl.textContent = state.lanShare.enabled
      ? (state.lanShare.urls[0] || textFor('lanNoAddress'))
      : textFor('lanUrlIdle');
  }
}

async function loadLanShareStatus() {
  try {
    const status = await window.companion.getLanShareStatus();
    applyLanShareStatus(status);
  } catch {
    applyLanShareStatus({ enabled: false });
  }
}

async function toggleLanShare() {
  const enabled = Boolean(elements.lanShareToggle?.checked);

  if (elements.lanShareToggle) {
    elements.lanShareToggle.disabled = true;
  }

  try {
    const status = await window.companion.setLanShareEnabled(enabled);
    applyLanShareStatus(status);
    await window.companion.saveSettings(buildSettingsPayload());
    elements.settingsStatus.textContent = status.enabled ? textFor('lanEnabledStatus') : textFor('lanDisabledStatus');
  } catch (error) {
    await loadLanShareStatus();
    elements.settingsStatus.textContent = error.message || textFor('lanFailed');
  } finally {
    if (elements.lanShareToggle) {
      elements.lanShareToggle.disabled = false;
    }
  }
}

async function toggleLowCpuMode() {
  applyPerformanceValues({ performance: { lowCpuMode: elements.lowCpuModeToggle?.checked !== false } });
  await window.companion.saveSettings(buildSettingsPayload());
  elements.settingsStatus.textContent = textFor('performanceUpdated');
}

function handleLanShareReceived(payload = {}) {
  const items = Array.isArray(payload.items) ? payload.items : [];
  if (items.length === 0) {
    return;
  }

  state.attachments = state.attachments.concat(items);
  updateContextStatus();

  const successCount = items.filter((item) => !item.error).length;
  const errorCount = items.length - successCount;
  const message = errorCount
    ? formatText('lanReceivedPartial', { success: successCount, failed: errorCount })
    : formatText('lanReceived', { success: successCount });
  setCompactAnswer(message);
  elements.settingsStatus.textContent = message;
}

async function chooseTheme(theme) {
  applyTheme(theme);
  await window.companion.saveSettings(buildSettingsPayload());
}

async function loadSettings() {
  const settings = await window.companion.getSettings();
  applyProviderValues(settings);
  applyComputerAccessValues(settings);
  applyPerformanceValues(settings);
  applyTheme(settings.theme || 'dark');
  elements.settingsStatus.textContent = providerSlots[0].apiKeyInput.value ? textFor('configured') : textFor('waitingKey');
}

function closeModelMenu(slotIndex = null) {
  const slots = slotIndex === null ? providerSlots : [providerSlots[slotIndex]];

  for (const slot of slots.filter(Boolean)) {
    slot.modelCombo.classList.remove('is-open');
    slot.modelMenuButton.setAttribute('aria-expanded', 'false');
  }
}

function openModelMenu(slotIndex = 0) {
  const slot = providerSlots[slotIndex];
  renderModelMenu(slotIndex);
  slot.modelCombo.classList.add('is-open');
  slot.modelMenuButton.setAttribute('aria-expanded', 'true');
}

function renderModelMenu(slotIndex = 0) {
  const slot = providerSlots[slotIndex];
  const models = state.modelLists[slotIndex] || [];
  slot.modelMenu.textContent = '';

  if (models.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'model-empty';
    empty.textContent = textFor('modelEmpty');
    slot.modelMenu.appendChild(empty);
    return;
  }

  for (const model of models) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'model-option';
    item.textContent = model;
    item.title = model;
    item.addEventListener('click', () => {
      state.activeProviderIndex = slotIndex;
      slot.modelInput.value = model;
      elements.settingsStatus.textContent = formatText('modelSelected', { provider: providerDisplayName(slotIndex) });
      closeModelMenu(slotIndex);
    });
    slot.modelMenu.appendChild(item);
  }
}

async function refreshModels(slotIndex = 0) {
  const slot = providerSlots[slotIndex];
  setBusy(true);
  slot.refreshButton.disabled = true;
  slot.refreshButton.classList.add('is-loading');
  elements.settingsStatus.textContent = formatText('refreshingModels', { provider: providerDisplayName(slotIndex) });

  try {
    const result = await window.companion.listModels({
      apiKey: slot.apiKeyInput.value,
      baseUrl: slot.baseUrlInput.value
    });

    state.modelLists[slotIndex] = result.models || [];
    renderModelMenu(slotIndex);

    if (!slot.modelInput.value && state.modelLists[slotIndex].length > 0) {
      slot.modelInput.value = state.modelLists[slotIndex][0];
    }

    elements.settingsStatus.textContent = state.modelLists[slotIndex].length
      ? formatText('modelsFetched', { provider: providerDisplayName(slotIndex), count: state.modelLists[slotIndex].length })
      : textFor('noModels');
    openModelMenu(slotIndex);
  } catch (error) {
    elements.settingsStatus.textContent = error.message || textFor('modelRefreshFailed');
  } finally {
    slot.refreshButton.disabled = false;
    slot.refreshButton.classList.remove('is-loading');
    setBusy(false);
  }
}

async function loadModelListQuietly(slotIndex = 0) {
  const slot = providerSlots[slotIndex];
  const result = await window.companion.listModels({
    apiKey: slot.apiKeyInput.value,
    baseUrl: slot.baseUrlInput.value
  });

  state.modelLists[slotIndex] = result.models || [];
  renderModelMenu(slotIndex);
  return state.modelLists[slotIndex];
}

function closeCompactModelPanel() {
  elements.compactModelPanel.hidden = true;
  elements.compactModelPanel.textContent = '';
  elements.compactModelButton.classList.remove('is-active');
}

function getCombinedModelOptions() {
  const options = [];

  providerSlots.forEach((slot, slotIndex) => {
    if (!slot.baseUrlInput.value.trim() || (!slot.local && !slot.apiKeyInput.value.trim())) {
      return;
    }

    const models = [...new Set([
      slot.modelInput.value.trim(),
      ...(state.modelLists[slotIndex] || [])
    ].filter(Boolean))];

    for (const model of models) {
      options.push({ slot, slotIndex, model });
    }
  });

  return options;
}

function renderCompactModelPanel(message = '') {
  const panel = elements.compactModelPanel;
  panel.textContent = '';
  panel.hidden = false;
  elements.compactModelButton.classList.add('is-active');

  const options = getCombinedModelOptions();
  if (options.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'compact-model-empty';
    empty.textContent = message || textFor('compactModelNeedConfig');
    panel.appendChild(empty);
    return;
  }

  for (const option of options) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'compact-model-option';
    item.classList.toggle('is-active', option.slotIndex === state.activeProviderIndex && option.slot.modelInput.value.trim() === option.model);
    const providerName = providerDisplayName(option.slotIndex);
    item.title = `${providerName} · ${option.model}`;

    const source = document.createElement('span');
    source.textContent = providerName;

    const model = document.createElement('strong');
    model.textContent = option.model;

    item.append(source, model);
    item.addEventListener('click', async () => {
      state.activeProviderIndex = option.slotIndex;
      option.slot.modelInput.value = option.model;
      await window.companion.saveSettings(buildSettingsPayload());
      elements.settingsStatus.textContent = formatText('providerSelectedModel', { provider: providerName, model: option.model });
      setCompactAnswer(formatText('switchedModel', { provider: providerName, model: option.model }));
      closeCompactModelPanel();
    });

    panel.appendChild(item);
  }
}

async function openCompactModelPanel() {
  const configuredSlots = providerSlots
    .map((slot, slotIndex) => ({ slot, slotIndex }))
    .filter(({ slot }) => slot.baseUrlInput.value.trim() && (slot.local || slot.apiKeyInput.value.trim()));

  renderCompactModelPanel(textFor('compactModelFetching'));

  if (configuredSlots.length === 0) {
    return;
  }

  elements.compactModelButton.classList.add('is-loading');
  const results = await Promise.allSettled(
    configuredSlots.map(({ slotIndex }) => loadModelListQuietly(slotIndex))
  );
  elements.compactModelButton.classList.remove('is-loading');

  const failed = results.filter((result) => result.status === 'rejected').length;
  renderCompactModelPanel(failed === configuredSlots.length ? textFor('compactModelFetchFailed') : '');
}

async function toggleCompactModelPanel() {
  if (!elements.compactModelPanel.hidden) {
    closeCompactModelPanel();
    return;
  }

  closeCompactHistoryPanel();
  closeScreenshotPreview();

  try {
    await openCompactModelPanel();
  } catch (error) {
    renderCompactModelPanel(error.message || textFor('modelRefreshFailed'));
  }
}

async function saveSettings() {
  setBusy(true);
  setButtonBusy(elements.saveSettingsButton, true, textFor('saving'));

  try {
    const settings = await window.companion.saveSettings(buildSettingsPayload());
    applyProviderValues(settings);
    elements.settingsStatus.textContent = textFor('saved');
  } catch (error) {
    elements.settingsStatus.textContent = error.message || textFor('saveFailed');
  } finally {
    setButtonBusy(elements.saveSettingsButton, false);
    setBusy(false);
  }
}

async function chooseWorkspaceRoot() {
  try {
    const workspaceRoot = await window.companion.selectWorkspaceRoot();

    if (!workspaceRoot) {
      return;
    }

    elements.workspaceRootInput.value = workspaceRoot;
    if (elements.commandAccessToggle) {
      elements.commandAccessToggle.disabled = false;
    }
    applyComputerAccessValues({
      computerAccess: {
        enabled: true,
        workspaceRoot,
        allowCommands: Boolean(elements.commandAccessToggle?.checked)
      }
    });
    await window.companion.saveSettings(buildSettingsPayload());
    elements.settingsStatus.textContent = textFor('workspaceAuthorizedStatus');
  } catch (error) {
    elements.settingsStatus.textContent = error.message || textFor('chooseWorkspaceFailed');
  }
}

async function clearWorkspaceAccess() {
  elements.workspaceRootInput.value = '';
  if (elements.commandAccessToggle) {
    elements.commandAccessToggle.checked = false;
    elements.commandAccessToggle.disabled = true;
  }
  applyComputerAccessValues({ computerAccess: { enabled: false, workspaceRoot: '', allowCommands: false } });
  await window.companion.saveSettings(buildSettingsPayload());
  elements.settingsStatus.textContent = textFor('workspaceRevokedStatus');
}

async function toggleCommandAccess() {
  const enabled = Boolean(elements.workspaceRootInput.value);

  if (!enabled) {
    elements.commandAccessToggle.checked = false;
    await chooseWorkspaceRoot();
    return;
  }

  await window.companion.saveSettings(buildSettingsPayload());
  elements.settingsStatus.textContent = elements.commandAccessToggle.checked ? textFor('commandEnabledStatus') : textFor('commandDisabledStatus');
}

async function selectRegion() {
  setCompactAnswer(textFor('screenshotSelecting'), true);
  try {
    await window.companion.selectRegion();
  } catch (error) {
    setCompactAnswer(error.message || textFor('screenshotFailed'));
  }
}

function setScreenshot(payload) {
  state.screenshotDataUrl = payload?.dataUrl || '';
  renderScreenshotContext();
  updateContextStatus();
  if (state.screenshotDataUrl) {
    setCompactAnswer(textFor('screenshotReady'));
    openScreenshotPreview();
  }
}

function getFilePaths(fileList) {
  const paths = [];
  const missing = [];

  for (const file of Array.from(fileList || [])) {
    const filePath = window.companion.getPathForFile(file);
    if (filePath) {
      paths.push(filePath);
    } else {
      missing.push(file.name);
    }
  }

  return { paths, missing };
}

async function appendIngestedItems(items = []) {
  state.attachments = state.attachments.concat(items);
  updateContextStatus();

  const successCount = items.filter((item) => !item.error).length;
  const errorCount = items.length - successCount;
  const message = errorCount
    ? formatText('filesReadPartial', { success: successCount, failed: errorCount })
    : formatText('filesReadReady', { success: successCount });

  setCompactAnswer(message);
  await window.companion.setWindowMode('compact');
  await window.companion.revealCompactWindow();
  elements.compactPromptInput.focus();
}

async function ingestPaths(paths, missingNames = []) {
  if (paths.length === 0) {
    if (missingNames.length > 0) {
      setCompactAnswer(formatText('missingFilePath', { names: missingNames.join('、') }));
    }
    return;
  }

  setBusy(true);
  setCompactAnswer(textFor('readingFiles'), true);

  try {
    const items = await window.companion.ingestFiles(paths);
    await appendIngestedItems(items);
  } catch (error) {
    setCompactAnswer(error.message || textFor('filesReadFailed'));
  } finally {
    setBusy(false);
  }
}

async function ingestFileList(fileList) {
  const files = Array.from(fileList || []);

  if (files.length === 0) {
    return;
  }

  if (typeof window.companion.ingestBrowserFiles === 'function') {
    setBusy(true);
    setCompactAnswer(textFor('readingFiles'), true);

    try {
      const items = await window.companion.ingestBrowserFiles(files);
      await appendIngestedItems(items);
    } catch (error) {
      setCompactAnswer(error.message || textFor('filesReadFailed'));
    } finally {
      setBusy(false);
    }
    return;
  }

  const { paths, missing } = getFilePaths(files);
  await ingestPaths(paths, missing);
}

async function askFromCompact() {
  const question = elements.compactPromptInput.value.trim();
  const attachments = state.attachments
    .filter((item) => item.text && !item.error)
    .map((item) => ({
      id: item.id,
      name: item.name,
      type: item.type,
      size: item.size,
      text: item.text
    }));

  if (!question && !state.screenshotDataUrl && attachments.length === 0) {
    setCompactAnswer(textFor('needPromptOrContext'));
    return;
  }

  setBusy(true);
  elements.compactSendButton.classList.add('is-loading');
  setCompactAnswer(textFor('thinking'), true);

  try {
    await window.companion.saveSettings(buildSettingsPayload());

    const result = await window.companion.analyzeContext({
      imageDataUrl: state.screenshotDataUrl,
      activeTitle: state.activeContext.checkedAt ? state.activeContext.title : '',
      note: question,
      attachments
    });

    setCompactAnswer(result.content);
    addHistory({
      question: question || textFor('contextAnalysis'),
      answer: result.content,
      model: result.model,
      hasImage: Boolean(state.screenshotDataUrl),
      attachmentCount: attachments.length
    });
    elements.compactPromptInput.value = '';
    elements.settingsStatus.textContent = formatText('usingModel', { model: result.model });
  } catch (error) {
    setCompactAnswer(error.message || textFor('analysisFailed'));
  } finally {
    elements.compactSendButton.classList.remove('is-loading');
    setBusy(false);
  }
}

function getPreparedAttachments() {
  return state.attachments
    .filter((item) => item.text && !item.error)
    .map((item) => ({
      id: item.id,
      name: item.name,
      type: item.type,
      size: item.size,
      text: item.text
    }));
}

async function runAssistantRequest(question, options = {}) {
  const attachments = getPreparedAttachments();

  if (!question && !state.screenshotDataUrl && attachments.length === 0) {
    setCompactAnswer(textFor('needPromptOrContext'));
    return false;
  }

  setBusy(true);
  elements.compactSendButton.classList.add('is-loading');
  setCompactAnswer(options.pendingText || textFor('thinking'), true);

  try {
    await window.companion.saveSettings(buildSettingsPayload());

    const result = await window.companion.analyzeContext({
      imageDataUrl: state.screenshotDataUrl,
      activeTitle: state.activeContext.checkedAt ? state.activeContext.title : '',
      note: question,
      attachments
    });

    setCompactAnswer(result.content);
    addHistory({
      question: question || textFor('contextAnalysis'),
      answer: result.content,
      model: result.model,
      hasImage: Boolean(state.screenshotDataUrl),
      attachmentCount: attachments.length
    });

    if (options.clearInput !== false) {
      elements.compactPromptInput.value = '';
    }

    elements.settingsStatus.textContent = formatText('usingModel', { model: result.model });
    return true;
  } catch (error) {
    setCompactAnswer(error.message || textFor('analysisFailed'));
    return false;
  } finally {
    elements.compactSendButton.classList.remove('is-loading');
    setBusy(false);
  }
}

async function askFromCompact() {
  const question = elements.compactPromptInput.value.trim();
  await runAssistantRequest(question, { clearInput: true });
}

async function triggerFilePicker() {
  if (typeof window.companion.selectAnalysisSources === 'function') {
    try {
      const paths = await window.companion.selectAnalysisSources();
      await ingestPaths(paths || []);
    } catch (error) {
      setCompactAnswer(error.message || textFor('filesReadFailed'));
    }
    return;
  }

  elements.hiddenFileInput.click();
}

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

function stopVoiceTracks() {
  if (state.voiceStream) {
    for (const track of state.voiceStream.getTracks()) {
      track.stop();
    }
  }

  state.voiceStream = null;
}

async function finishVoiceRecording() {
  const mimeType = state.mediaRecorder?.mimeType || 'audio/webm';
  const chunks = state.voiceChunks.slice();
  state.voiceChunks = [];
  state.mediaRecorder = null;
  stopVoiceTracks();

  if (chunks.length === 0) {
    setCompactAnswer(textFor('noVoiceCaptured'));
    return;
  }

  setBusy(true);
  setCompactAnswer(textFor('transcribingVoice'), true);

  try {
    const blob = new Blob(chunks, { type: mimeType });
    const audioBuffer = await blob.arrayBuffer();
    const result = await window.companion.transcribeAudio({ audioBuffer, mimeType });
    const current = elements.compactPromptInput.value.trim();
    elements.compactPromptInput.value = current ? `${current} ${result.text}` : result.text;
    setCompactAnswer(textFor('voiceAdded'));
    elements.compactPromptInput.focus();
  } catch (error) {
    setCompactAnswer(error.message || textFor('voiceFailed'));
  } finally {
    setBusy(false);
  }
}

async function toggleVoiceInput() {
  if (state.isRecording) {
    state.isRecording = false;
    elements.compactMicButton.classList.remove('is-recording');
    elements.compactMicButton.classList.remove('is-active');
    state.mediaRecorder?.stop();
    return;
  }

  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    setCompactAnswer(textFor('voiceUnavailable'));
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });
    const mimeType = getPreferredAudioMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

    state.voiceStream = stream;
    state.mediaRecorder = recorder;
    state.voiceChunks = [];
    state.isRecording = true;
    elements.compactMicButton.classList.add('is-recording');
    elements.compactMicButton.classList.add('is-active');
    setCompactAnswer(textFor('recordingVoice'), true);

    recorder.addEventListener('dataavailable', (event) => {
      if (event.data && event.data.size > 0) {
        state.voiceChunks.push(event.data);
      }
    });
    recorder.addEventListener('stop', () => {
      state.isRecording = false;
      elements.compactMicButton.classList.remove('is-recording');
      elements.compactMicButton.classList.remove('is-active');
      finishVoiceRecording();
    }, { once: true });
    recorder.start(250);
  } catch (error) {
    state.isRecording = false;
    stopVoiceTracks();
    elements.compactMicButton.classList.remove('is-recording');
    elements.compactMicButton.classList.remove('is-active');
    setCompactAnswer(error.message || textFor('microphoneDenied'));
  }
}

function clearVoiceTimers() {
  clearTimeout(state.voiceSegmentTimer);
  clearTimeout(state.voiceRestartTimer);
  state.voiceSegmentTimer = null;
  state.voiceRestartTimer = null;
}

function applyVoiceUiState() {
  elements.compactMicButton.classList.toggle('is-recording', state.isRecording);
  elements.compactMicButton.classList.toggle('is-active', state.isRecording);
  elements.compactMicButton.classList.toggle('is-awake', state.voiceAwake);
  document.body.dataset.voice = state.isRecording
    ? (state.voiceAwake ? 'awake' : 'listening')
    : 'idle';
}

function stopVoiceMode(message = '') {
  clearVoiceTimers();
  state.isRecording = false;
  state.voiceAwake = false;
  state.voiceChunks = [];

  const recorder = state.mediaRecorder;
  state.mediaRecorder = null;

  if (recorder && recorder.state !== 'inactive') {
    try {
      recorder.stop();
    } catch {
      // The recorder can already be stopped by the segment timer.
    }
  }

  stopVoiceTracks();
  elements.compactMicButton.classList.remove('is-processing');
  applyVoiceUiState();

  if (message) {
    setCompactAnswer(message);
  }
}

function scheduleNextVoiceSegment(delay = VOICE_RESTART_MS) {
  clearTimeout(state.voiceRestartTimer);

  if (!state.isRecording) {
    return;
  }

  state.voiceRestartTimer = setTimeout(() => {
    state.voiceRestartTimer = null;
    startVoiceSegment().catch((error) => {
      stopVoiceMode(error.message || textFor('voiceStartFailed'));
    });
  }, delay);
}

async function ensureVoiceStream() {
  if (state.voiceStream && state.voiceStream.active) {
    return state.voiceStream;
  }

  state.voiceStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    }
  });

  return state.voiceStream;
}

async function startVoiceSegment() {
  if (!state.isRecording) {
    return;
  }

  const stream = await ensureVoiceStream();
  const mimeType = getPreferredAudioMimeType();
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks = [];
  const finalMimeType = recorder.mimeType || mimeType || 'audio/webm';

  state.mediaRecorder = recorder;
  state.voiceChunks = chunks;
  state.voiceMimeType = finalMimeType;
  applyVoiceUiState();

  recorder.addEventListener('dataavailable', (event) => {
    if (event.data && event.data.size > 0) {
      chunks.push(event.data);
    }
  });

  recorder.addEventListener('stop', async () => {
    clearTimeout(state.voiceSegmentTimer);
    state.voiceSegmentTimer = null;

    if (state.mediaRecorder === recorder) {
      state.mediaRecorder = null;
    }

    if (state.isRecording) {
      await processVoiceSegment(finalMimeType, chunks);
    }

    if (state.isRecording) {
      scheduleNextVoiceSegment();
    }
  }, { once: true });

  recorder.start(250);
  state.voiceSegmentTimer = setTimeout(() => {
    if (recorder.state !== 'inactive') {
      recorder.stop();
    }
  }, VOICE_SEGMENT_MS);
}

async function processVoiceSegment(mimeType, chunks) {
  if (!chunks.length) {
    return;
  }

  elements.compactMicButton.classList.add('is-processing');

  try {
    const blob = new Blob(chunks, { type: mimeType });
    const audioBuffer = await blob.arrayBuffer();
    const result = await window.companion.transcribeAudio({ audioBuffer, mimeType });
    const transcript = String(result.text || '').trim();

    if (!transcript) {
      return;
    }

    if (!state.voiceAwake) {
      const command = extractWakeCommand(transcript);

      if (command === null) {
        setCompactAnswer(textFor('waitingWake'), true);
        return;
      }

      state.voiceAwake = true;
      applyVoiceUiState();

      if (!command) {
        setCompactAnswer(textFor('voiceAwake'), true);
        return;
      }

      await handleVoiceCommand(command);
      return;
    }

    await handleVoiceCommand(transcript);
  } catch (error) {
    const message = error.message || textFor('voiceFailed');

    if (/api key|unauthorized|forbidden|401|403/i.test(message)) {
      stopVoiceMode(message);
      return;
    }

    setCompactAnswer(formatText('keepListening', { message }), true);
  } finally {
    elements.compactMicButton.classList.remove('is-processing');
  }
}

function normalizeVoiceText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/\u55e8|\u563f/g, 'hi')
    .replace(/[.,!?;:"'`~()[\]{}<>_\-]+/g, ' ')
    .replace(/[\u3001\u3002\uff0c\uff1f\uff01\uff1a\uff1b]+/g, ' ')
    .replace(/[\u3000\s]+/g, ' ')
    .trim();
}

function extractWakeCommand(text) {
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

function isStopVoiceCommand(text) {
  const normalized = normalizeVoiceText(text);
  const compact = normalized.replace(/\s+/g, '');

  return [
    'stop voice',
    'stop listening',
    'exit voice',
    'cancel voice',
    '\u9000\u51fa\u8bed\u97f3',
    '\u505c\u6b62\u8bed\u97f3',
    '\u7ed3\u675f\u8bed\u97f3',
    '\u5173\u95ed\u8bed\u97f3'
  ].some((phrase) => normalized.includes(phrase) || compact.includes(phrase.replace(/\s+/g, '')));
}

function isImageCommand(text) {
  const normalized = normalizeVoiceText(text);
  const compact = normalized.replace(/\s+/g, '');

  return /(^|\s)(draw|paint)\b/.test(normalized)
    || /(^|\s)(generate|create|make)\b.*\b(image|picture|pic|drawing|art)\b/.test(normalized)
    || compact.includes('\u751f\u56fe')
    || compact.includes('\u753b\u56fe')
    || compact.includes('\u753b\u4e00\u5f20')
    || compact.includes('\u751f\u6210\u56fe\u7247')
    || compact.includes('\u751f\u6210\u4e00\u5f20')
    || compact.includes('\u7ed8\u5236\u56fe')
    || compact.includes('\u751f\u6210\u56fe\u50cf');
}

function cleanImagePrompt(text) {
  const wakeCommand = extractWakeCommand(text);
  let prompt = String(wakeCommand === null ? text : wakeCommand).trim();
  const original = prompt;

  prompt = prompt
    .replace(/^(please\s+)?(draw|paint|generate|create|make)\s+(me\s+)?(an?\s+)?(image|picture|pic|drawing|art)?\s*(of|about|for)?\s*/i, '')
    .trim();

  for (const phrase of [
    '\u5e2e\u6211',
    '\u8bf7',
    '\u7ed9\u6211',
    '\u753b\u4e00\u5f20',
    '\u753b\u56fe',
    '\u753b',
    '\u751f\u56fe',
    '\u751f\u6210\u56fe\u7247',
    '\u751f\u6210\u4e00\u5f20',
    '\u751f\u6210\u56fe\u50cf',
    '\u7ed8\u5236\u56fe\u7247',
    '\u7ed8\u5236'
  ]) {
    prompt = prompt.replace(new RegExp(`^\\s*${phrase}\\s*`, 'u'), '').trim();
  }

  prompt = prompt.replace(/^[\s:,\u3002\uff0c\uff1a;!-]+/u, '').trim();
  return prompt || (isImageCommand(original) ? '' : original.trim());
}

async function runImageRequest(prompt) {
  const imagePrompt = String(prompt || '').trim();

  if (!imagePrompt) {
    setCompactAnswer(textFor('imagePromptNeeded'), true);
    return false;
  }

  setBusy(true);
  elements.compactMicButton.classList.add('is-processing');
  setCompactAnswer(textFor('imageGenerating'), true);

  try {
    await window.companion.saveSettings(buildSettingsPayload());
    const result = await window.companion.generateImage({ prompt: imagePrompt });
    const answer = formatText('imageGenerated', { prompt: imagePrompt });

    setCompactAnswer(answer, false, result.imageDataUrl);
    addHistory({
      question: `\u751f\u56fe\uff1a${imagePrompt}`,
      answer,
      imageUrl: result.imageDataUrl,
      model: result.model,
      hasImage: false,
      attachmentCount: 0
    });
    elements.settingsStatus.textContent = formatText('usingModel', { model: result.model });
    return true;
  } catch (error) {
    setCompactAnswer(error.message || textFor('imageFailed'));
    return false;
  } finally {
    elements.compactMicButton.classList.remove('is-processing');
    setBusy(false);
  }
}

async function handleVoiceCommand(text) {
  const command = (extractWakeCommand(text) ?? text).trim();

  if (!command) {
    setCompactAnswer(textFor('voiceNeed'), true);
    return;
  }

  if (isStopVoiceCommand(command)) {
    stopVoiceMode(textFor('voiceClosed'));
    return;
  }

  if (isImageCommand(command)) {
    await runImageRequest(cleanImagePrompt(command));
    return;
  }

  elements.compactPromptInput.value = command;
  await runAssistantRequest(command, {
    clearInput: true,
    pendingText: textFor('answeringVoice')
  });
}

async function toggleVoiceInput() {
  if (state.isRecording) {
    stopVoiceMode(textFor('voiceClosed'));
    return;
  }

  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    setCompactAnswer(textFor('voiceUnavailable'));
    return;
  }

  try {
    await window.companion.saveSettings(buildSettingsPayload());
    state.isRecording = true;
    state.voiceAwake = false;
    applyVoiceUiState();
    setCompactAnswer(textFor('waitingWake'), true);
    await startVoiceSegment();
  } catch (error) {
    stopVoiceMode(error.message || textFor('microphoneDenied'));
  }
}

async function openMainPanel(event) {
  event?.preventDefault?.();
  event?.stopPropagation?.();

  clearTimeout(state.agentTapTimer);
  state.agentTapTimer = null;
  state.lastAgentTapAt = 0;
  state.pointerInWindow = true;
  state.mainLockedOpen = true;
  clearAutoCompact();
  closeModelMenu();
  document.body.dataset.contextMenu = 'false';
  const modeState = await window.companion.setWindowMode('expanded');
  applyWindowMode(modeState);
}

async function showExitContextBlock(event) {
  event.preventDefault();
  if (state.windowMode !== 'compact') {
    return;
  }

  if (document.body.dataset.revealed !== 'true') {
    await window.companion.revealCompactWindow();
  }

  document.body.dataset.contextMenu = 'true';
}

function hideExitContextBlock(event) {
  if (!event.target.closest?.('#compactExitButton') && event.target !== elements.agentIcon) {
    document.body.dataset.contextMenu = 'false';
  }
}

async function toggleCompactPanel() {
  if (document.body.dataset.revealed === 'true') {
    await window.companion.hideCompactTools();
    return;
  }

  await window.companion.revealCompactWindow();
  elements.compactPromptInput.focus();
}

async function toggleAnswerZoom(event) {
  event?.preventDefault?.();
  event?.stopPropagation?.();

  if (state.windowMode !== 'compact') {
    return;
  }

  closeCompactHistoryPanel();
  closeCompactModelPanel();
  closeScreenshotPreview();
  const modeState = await window.companion.setAnswerZoom(!state.answerZoomed);
  applyWindowMode(modeState);
}

function handleAgentTap() {
  const now = performance.now();
  const isDoubleTap = now - state.lastAgentTapAt <= AGENT_DOUBLE_TAP_MS;

  if (isDoubleTap) {
    clearTimeout(state.agentTapTimer);
    state.agentTapTimer = null;
    state.lastAgentTapAt = 0;
    document.body.dataset.contextMenu = 'false';
    openMainPanel();
    return;
  }

  state.lastAgentTapAt = now;
  clearTimeout(state.agentTapTimer);

  if (document.body.dataset.revealed !== 'true') {
    toggleCompactPanel();
    state.agentTapTimer = setTimeout(() => {
      state.agentTapTimer = null;
      state.lastAgentTapAt = 0;
    }, AGENT_DOUBLE_TAP_MS);
    return;
  }

  state.agentTapTimer = setTimeout(() => {
    state.agentTapTimer = null;
    state.lastAgentTapAt = 0;
    toggleCompactPanel();
  }, AGENT_TAP_DELAY_MS);
}

function scheduleCompactDrag(point) {
  state.compactDragPoint = point;

  if (state.compactDragFrame) {
    return;
  }

  state.compactDragFrame = requestAnimationFrame(() => {
    state.compactDragFrame = null;
    const nextPoint = state.compactDragPoint;
    state.compactDragPoint = null;

    if (nextPoint) {
      window.companion.dragCompactWindow(nextPoint);
    }
  });
}

function flushCompactDrag() {
  if (state.compactDragFrame) {
    cancelAnimationFrame(state.compactDragFrame);
    state.compactDragFrame = null;
  }

  const nextPoint = state.compactDragPoint;
  state.compactDragPoint = null;

  if (nextPoint) {
    window.companion.dragCompactWindow(nextPoint);
  }
}

providerSlots.forEach((slot, index) => {
  slot.refreshButton.addEventListener('click', () => refreshModels(index));
  slot.modelMenuButton.addEventListener('click', (event) => {
    event.stopPropagation();
    if (slot.modelCombo.classList.contains('is-open')) {
      closeModelMenu(index);
    } else {
      closeModelMenu();
      openModelMenu(index);
    }
  });
  slot.modelInput.addEventListener('focus', () => {
    if ((state.modelLists[index] || []).length > 0) {
      openModelMenu(index);
    }
  });
});
elements.saveSettingsButton.addEventListener('click', saveSettings);
elements.chooseWorkspaceButton?.addEventListener('click', chooseWorkspaceRoot);
elements.clearWorkspaceButton?.addEventListener('click', clearWorkspaceAccess);
elements.commandAccessToggle?.addEventListener('change', toggleCommandAccess);
elements.startupLaunchToggle?.addEventListener('change', toggleStartupLaunch);
elements.lowCpuModeToggle?.addEventListener('change', toggleLowCpuMode);
elements.lanShareToggle?.addEventListener('change', toggleLanShare);
elements.guideTabs.forEach((tab) => {
  tab.addEventListener('click', () => renderGuide(tab.dataset.guideLang));
});
elements.themeDarkButton.addEventListener('click', () => chooseTheme('dark'));
elements.themeLightButton.addEventListener('click', () => chooseTheme('light'));
elements.compactModelButton.addEventListener('click', toggleCompactModelPanel);
elements.compactShotButton.addEventListener('click', selectRegion);
elements.compactFileButton.addEventListener('click', triggerFilePicker);
elements.compactMicButton.addEventListener('click', toggleVoiceInput);
elements.compactOpenButton.addEventListener('click', openMainPanel);
elements.compactExitButton.addEventListener('click', () => window.companion.closeWindow());
elements.compactSendButton.addEventListener('click', askFromCompact);
elements.compactHistoryButton.addEventListener('click', toggleCompactHistoryPanel);
elements.compactAnswerExpandButton.addEventListener('click', toggleAnswerZoom);
elements.compactScreenshotPreviewButton?.addEventListener('click', openScreenshotPreview);
elements.compactScreenshotDeleteButton?.addEventListener('click', clearScreenshot);
elements.compactScreenshotPreviewDeleteButton?.addEventListener('click', clearScreenshot);
elements.compactScreenshotPreviewCloseButton?.addEventListener('click', (event) => {
  event.preventDefault();
  event.stopPropagation();
  closeScreenshotPreview();
});
elements.compactPromptInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    askFromCompact();
  }
});
elements.hiddenFileInput.addEventListener('change', async () => {
  await ingestFileList(elements.hiddenFileInput.files);
  elements.hiddenFileInput.value = '';
});

document.addEventListener('click', (event) => {
  if (!providerSlots.some((slot) => slot.modelCombo.contains(event.target))) {
    closeModelMenu();
  }
  if (!elements.compactModelPanel.hidden
    && !elements.compactModelPanel.contains(event.target)
    && !elements.compactModelButton.contains(event.target)) {
    closeCompactModelPanel();
  }
  if (elements.compactHistoryPanel
    && !elements.compactHistoryPanel.hidden
    && !elements.compactHistoryPanel.contains(event.target)
    && !elements.compactHistoryButton.contains(event.target)) {
    closeCompactHistoryPanel();
  }
  if (elements.compactScreenshotPreviewPanel
    && !elements.compactScreenshotPreviewPanel.hidden
    && !elements.compactScreenshotPreviewPanel.contains(event.target)
    && !elements.compactScreenshotPreviewButton?.contains(event.target)) {
    closeScreenshotPreview();
  }
});

elements.clearHistoryButton.addEventListener('click', () => {
  state.history = [];
  state.selectedHistoryId = '';
  saveHistory();
  renderHistory();
});

elements.collapseButton.addEventListener('click', () => {
  state.mainLockedOpen = false;
  window.companion.setWindowMode('compact');
});
elements.minimizeButton.addEventListener('click', () => window.companion.minimizeWindow());
elements.closeButton.addEventListener('click', () => window.companion.closeWindow());
elements.pinButton.addEventListener('click', async () => {
  const pinned = await window.companion.togglePin();
  elements.pinButton.classList.toggle('is-active', pinned);
});

elements.agentIcon.addEventListener('contextmenu', showExitContextBlock);
document.addEventListener('pointerdown', hideExitContextBlock, { capture: true });

elements.agentIcon.addEventListener('pointerdown', (event) => {
  if (state.windowMode !== 'compact' || event.button !== 0) {
    return;
  }

  state.compactDrag = {
    pointerId: event.pointerId,
    startX: event.screenX,
    startY: event.screenY,
    distance: 0,
    started: false
  };

  elements.agentIcon.setPointerCapture(event.pointerId);
  event.preventDefault();
});

elements.agentIcon.addEventListener('pointermove', async (event) => {
  if (!state.compactDrag) {
    return;
  }

  const dx = event.screenX - state.compactDrag.startX;
  const dy = event.screenY - state.compactDrag.startY;
  state.compactDrag.distance = Math.abs(dx) + Math.abs(dy);

  if (state.compactDrag.distance > 6) {
    if (!state.compactDrag.started) {
      state.compactDrag.started = true;
      await window.companion.beginCompactDrag({
        screenX: state.compactDrag.startX,
        screenY: state.compactDrag.startY
      });
      if (!state.compactDrag) {
        return;
      }
    }

    scheduleCompactDrag({ screenX: event.screenX, screenY: event.screenY });
  }
});

elements.agentIcon.addEventListener('pointerup', async (event) => {
  if (!state.compactDrag) {
    return;
  }

  const pointerId = state.compactDrag.pointerId;
  const distance = state.compactDrag.distance;
  const wasDragging = state.compactDrag.started;
  state.compactDrag = null;

  if (elements.agentIcon.hasPointerCapture(pointerId)) {
    elements.agentIcon.releasePointerCapture(pointerId);
  }

  if (!wasDragging || distance <= 6) {
    handleAgentTap();
    return;
  }

  flushCompactDrag();
  await window.companion.endCompactDrag();
  event.preventDefault();
});

elements.agentIcon.addEventListener('pointercancel', () => {
  const wasDragging = state.compactDrag?.started;
  state.compactDrag = null;
  flushCompactDrag();
  if (wasDragging) {
    window.companion.endCompactDrag();
  }
});

document.addEventListener('mouseenter', () => {
  if (state.windowMode !== 'expanded') {
    return;
  }

  state.pointerInWindow = true;
  clearAutoCompact();
});

document.addEventListener('mousemove', () => {
  if (state.windowMode !== 'expanded') {
    return;
  }

  state.pointerInWindow = true;
  clearAutoCompact();
}, { passive: true });

document.addEventListener('mouseleave', () => {
  state.pointerInWindow = false;
  scheduleAutoCompact();
});

window.addEventListener('dragenter', (event) => {
  event.preventDefault();
  state.dragDepth += 1;
  document.body.dataset.dragging = 'true';
});

window.addEventListener('dragover', (event) => {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'copy';
});

window.addEventListener('dragleave', (event) => {
  event.preventDefault();
  state.dragDepth = Math.max(0, state.dragDepth - 1);
  if (state.dragDepth === 0) {
    document.body.dataset.dragging = 'false';
  }
});

window.addEventListener('drop', async (event) => {
  event.preventDefault();
  state.dragDepth = 0;
  document.body.dataset.dragging = 'false';
  await ingestFileList(event.dataTransfer.files);
});

window.companion.onContextUpdated((context) => {
  state.activeContext = context || state.activeContext;
});
window.companion.onWindowModeChanged(applyWindowMode);
window.companion.onScreenshotCreated(async (payload) => {
  setScreenshot(payload);
  await window.companion.setWindowMode('compact');
  await window.companion.revealCompactWindow();
  elements.compactPromptInput.focus();
});
window.companion.onScreenshotError((message) => {
  setCompactAnswer(message || textFor('screenshotFailed'));
});

window.companion.onLanShareReceived(handleLanShareReceived);
window.companion.onUpdateStatus?.((status = {}) => {
  if (elements.settingsStatus && ['available', 'downloading', 'downloaded', 'error'].includes(status.state)) {
    elements.settingsStatus.textContent = status.message || '';
  }
});

loadHistory();
renderHistory();
renderGuide();
updateContextStatus();
renderScreenshotContext();

Promise.all([
  loadContext().catch(() => null),
  loadSettings().catch((error) => {
    elements.settingsStatus.textContent = error.message || textFor('loadingConfigFailed');
  }),
  loadStartupSettings().catch(() => null),
  loadLanShareStatus().catch(() => null),
  window.companion.getWindowMode()
]).then(([, , , , modeState]) => {
  applyWindowMode(modeState);
});
}
