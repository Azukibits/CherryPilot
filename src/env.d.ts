/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';

  const component: DefineComponent<object, object, unknown>;
  export default component;
}

interface CompanionProviderSettings {
  id?: string;
  label?: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  local?: boolean;
}

interface CompanionComputerAccessSettings {
  enabled?: boolean;
  workspaceRoot?: string;
  allowCommands?: boolean;
}

interface CompanionPerformanceSettings {
  lowCpuMode?: boolean;
}

interface CompanionLanShareStatus {
  enabled?: boolean;
  port?: number;
  token?: string;
  urls?: string[];
}

interface CompanionSettings {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  theme?: string;
  activeProviderIndex?: number;
  providers?: CompanionProviderSettings[];
  computerAccess?: CompanionComputerAccessSettings;
  performance?: CompanionPerformanceSettings;
  lanShare?: CompanionLanShareStatus;
}

interface CompanionActiveContext {
  title: string;
  checkedAt: string | null;
}

interface CompanionAttachmentItem {
  id?: string;
  name?: string;
  path?: string;
  type?: string;
  size?: number;
  text?: string;
  preview?: string;
  error?: string;
}

interface CompanionAnalysisAttachment {
  id?: string;
  name?: string;
  type?: string;
  size?: number;
  text?: string;
}

interface CompanionAnalyzeContextPayload {
  imageDataUrl?: string;
  activeTitle?: string;
  note?: string;
  attachments?: CompanionAnalysisAttachment[];
}

interface CompanionAnalyzeResult {
  content: string;
  model: string;
  analyzedAt?: string;
}

interface CompanionScreenshotPayload {
  dataUrl?: string;
  capturedAt?: string;
  source?: string;
}

interface CompanionAudioPayload {
  audioBuffer: ArrayBuffer;
  mimeType: string;
}

interface CompanionWindowModeState {
  mode?: string;
  dockSide?: string;
  revealed?: boolean;
  docked?: boolean;
  answerZoomed?: boolean;
}

interface CompanionPoint {
  screenX: number;
  screenY: number;
}

interface CompanionUpdateStatus {
  state?: string;
  message?: string;
}

interface CompanionLanSharePayload {
  items?: CompanionAttachmentItem[];
}

type CompanionCleanup = () => void;

interface CompanionApi {
  getActiveContext(): Promise<CompanionActiveContext>;
  selectRegion(): Promise<unknown>;
  analyzeScreenshot(payload: CompanionAnalyzeContextPayload): Promise<CompanionAnalyzeResult>;
  analyzeContext(payload: CompanionAnalyzeContextPayload): Promise<CompanionAnalyzeResult>;
  transcribeAudio(payload: CompanionAudioPayload): Promise<{ text?: string }>;
  generateImage(payload: { prompt: string }): Promise<{ imageDataUrl: string; model: string }>;
  ingestFiles(paths: string[]): Promise<CompanionAttachmentItem[]>;
  ingestBrowserFiles?: (files: File[]) => Promise<CompanionAttachmentItem[]>;
  selectAnalysisSources?: () => Promise<string[]>;
  getSettings(): Promise<CompanionSettings>;
  saveSettings(payload: CompanionSettings): Promise<CompanionSettings>;
  getStartupSettings(): Promise<{ openAtLogin?: boolean }>;
  setStartupEnabled(enabled: boolean): Promise<{ openAtLogin?: boolean }>;
  getLanShareStatus(): Promise<CompanionLanShareStatus>;
  setLanShareEnabled(enabled: boolean): Promise<CompanionLanShareStatus>;
  selectWorkspaceRoot(): Promise<string>;
  listModels(payload: { apiKey?: string; baseUrl?: string }): Promise<{ models?: string[] }>;
  getWindowMode(): Promise<CompanionWindowModeState>;
  setWindowMode(mode: string): Promise<CompanionWindowModeState>;
  beginCompactDrag(point: CompanionPoint): Promise<unknown>;
  dragCompactWindow(point: CompanionPoint): Promise<unknown>;
  endCompactDrag(): Promise<unknown>;
  revealCompactWindow(): Promise<unknown>;
  hideCompactTools(): Promise<unknown>;
  setAnswerZoom(enabled: boolean): Promise<CompanionWindowModeState>;
  minimizeWindow(): Promise<void>;
  closeWindow(): Promise<void>;
  togglePin(): Promise<boolean>;
  getPathForFile(file: File): string;
  onContextUpdated(callback: (context: CompanionActiveContext) => void): CompanionCleanup;
  onWindowModeChanged(callback: (state: CompanionWindowModeState) => void): CompanionCleanup;
  onScreenshotCreated(callback: (payload: CompanionScreenshotPayload) => void): CompanionCleanup;
  onScreenshotError(callback: (message: string) => void): CompanionCleanup;
  onLanShareReceived(callback: (payload: CompanionLanSharePayload) => void): CompanionCleanup;
  onUpdateStatus?(callback: (status: CompanionUpdateStatus) => void): CompanionCleanup;
}

interface Window {
  // Typed preload bridge exposed from src/main/preload.ts.
  companion: CompanionApi;
}
