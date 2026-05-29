import { reactive, watch } from 'vue';
import { GUIDE_LANGUAGE_KEY, PROVIDERS } from '@/renderer/entity';
import { normalizeGuideLanguage, textFor } from '@/renderer/composables/companionText';

// 初始化引导语言，localStorage 不可用时回退中文。
function initialGuideLanguage() {
  try {
    return normalizeGuideLanguage(localStorage.getItem(GUIDE_LANGUAGE_KEY));
  } catch {
    return 'zh';
  }
}

// 历史记录条目，供历史面板和本地持久化复用。
export interface HistoryEntry {
  id: string;
  askedAt: string;
  question?: string;
  answer?: string;
  model?: string;
  hasImage?: boolean;
  imageUrl?: string;
  attachmentCount?: number;
}

// 附件条目沿用 preload bridge 的附件类型，避免 renderer 重复声明结构。
export type AttachmentItem = CompanionAttachmentItem;

// 悬浮窗拖拽过程中的指针状态。
interface CompactDragState {
  pointerId: number;
  startX: number;
  startY: number;
  distance: number;
  started: boolean;
}

// renderer 共享状态，所有组件和 composable 都从这里读写界面状态。
export const companionState = reactive({
  // 当前外部窗口上下文和截图/附件上下文。
  activeContext: { title: '', checkedAt: null as string | null },
  screenshotDataUrl: '',
  screenshotPreviewOpen: false,
  attachments: [] as AttachmentItem[],
  // 模型接口配置和各接口已拉取的模型列表。
  modelLists: PROVIDERS.map(() => [] as string[]),
  providers: PROVIDERS.map((provider) => ({
    ...provider,
    apiKey: '',
    baseUrl: provider.defaultBaseUrl,
    model: provider.defaultModel,
    menuOpen: false,
    isRefreshing: false
  })),
  activeProviderIndex: 0,
  // 历史记录、主题和引导语言。
  history: [] as HistoryEntry[],
  theme: 'dark' as 'dark' | 'light',
  guideLanguage: initialGuideLanguage(),
  // 运行配置：性能模式、电脑权限、开机启动和 LAN 分享。
  lowCpuMode: true,
  computerAccess: {
    enabled: false,
    workspaceRoot: '',
    allowCommands: false
  },
  startupOpenAtLogin: false,
  lanShare: {
    enabled: false,
    port: 0,
    token: '',
    urls: [] as string[]
  },
  // 回答区和悬浮输入的显示状态。
  statusText: '',
  answerContent: '',
  answerPending: false,
  answerImageUrl: '',
  compactPrompt: '',
  compactModelPanelOpen: false,
  compactModelPanelMessage: '',
  compactModelLoading: false,
  compactHistoryPanelOpen: false,
  // 语音输入相关状态和录音分段定时器。
  isRecording: false,
  voiceProcessing: false,
  mediaRecorder: null as MediaRecorder | null,
  voiceStream: null as MediaStream | null,
  voiceChunks: [] as Blob[],
  voiceAwake: false,
  voiceSegmentTimer: null as ReturnType<typeof setTimeout> | null,
  voiceRestartTimer: null as ReturnType<typeof setTimeout> | null,
  voiceMimeType: '',
  // 主窗口/悬浮窗模式镜像，实际窗口边界由主进程维护。
  windowMode: 'expanded',
  dockSide: 'right',
  revealed: false,
  docked: false,
  answerZoomed: false,
  contextMenuOpen: false,
  isBusy: false,
  pointerInWindow: false,
  // 悬浮球拖拽、点击和自动收起状态。
  compactDrag: null as CompactDragState | null,
  compactDragFrame: null as number | null,
  compactDragPoint: null as CompanionPoint | null,
  agentTapTimer: null as ReturnType<typeof setTimeout> | null,
  lastAgentTapAt: 0,
  dragDepth: 0,
  dragging: false,
  autoCompactTimer: null as ReturnType<typeof setTimeout> | null,
  mainLockedOpen: true
});

export type ProviderState = typeof companionState.providers[number];

// 统一切换界面忙碌状态。
export function setBusy(value: boolean) {
  companionState.isBusy = value;
}

// 更新底部/设置面板可复用的状态提示文案。
export function setStatusText(message: string) {
  companionState.statusText = message;
}

// 更新悬浮回答内容，可附带 pending 状态和生图结果。
export function setCompactAnswer(content: string, pending = false, imageUrl = '') {
  companionState.answerContent = content || textFor(companionState.guideLanguage, 'waitingQuestion');
  companionState.answerPending = pending;
  companionState.answerImageUrl = imageUrl;
}

// 将关键状态同步到 body.dataset，供全局 CSS 根据模式和状态切换样式。
export function useBodyDatasetSync() {
  watch(
    () => ({
      theme: companionState.theme,
      mode: companionState.windowMode,
      dockSide: companionState.dockSide,
      revealed: companionState.revealed,
      docked: companionState.docked,
      answerZoomed: companionState.answerZoomed,
      busy: companionState.isBusy,
      hasScreenshot: Boolean(companionState.screenshotDataUrl),
      dragging: companionState.dragging,
      contextMenuOpen: companionState.contextMenuOpen,
      voice: companionState.isRecording
        ? (companionState.voiceAwake ? 'awake' : 'listening')
        : 'idle'
    }),
    (dataset) => {
      document.body.dataset.theme = dataset.theme;
      document.body.dataset.mode = dataset.mode;
      document.body.dataset.dockSide = dataset.dockSide;
      document.body.dataset.revealed = dataset.revealed ? 'true' : 'false';
      document.body.dataset.docked = dataset.docked ? 'true' : 'false';
      document.body.dataset.answerZoomed = dataset.answerZoomed ? 'true' : 'false';
      document.body.dataset.busy = dataset.busy ? 'true' : 'false';
      document.body.dataset.hasScreenshot = dataset.hasScreenshot ? 'true' : 'false';
      document.body.dataset.dragging = dataset.dragging ? 'true' : 'false';
      document.body.dataset.contextMenu = dataset.contextMenuOpen ? 'true' : 'false';
      document.body.dataset.voice = dataset.voice;
    },
    { immediate: true }
  );
}
