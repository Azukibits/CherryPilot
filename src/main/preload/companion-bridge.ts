// preload 桥接 API
// 集中维护 window.companion 暴露给渲染层的方法，保持 IPC channel 名称稳定。
import { ipcRenderer, webUtils } from 'electron';

type BridgeCallback = (payload: unknown) => void;
type FileWithOptionalPath = File & { path?: string };

// 监听主进程主动推送的事件，并返回清理函数给渲染层。
function listen(channel: string, callback: BridgeCallback) {
  if (typeof callback !== 'function') {
    return () => {};
  }

  const listener = (_event: Electron.IpcRendererEvent, payload: unknown) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

// 创建 renderer 可访问的 companion API，具体业务实现由主进程 IPC handler 承接。
export function createCompanionBridge() {
  return {
    getActiveContext: () => ipcRenderer.invoke('active-context:get'),
    selectRegion: () => ipcRenderer.invoke('screen:select-region'),
    analyzeScreenshot: (payload: unknown) => ipcRenderer.invoke('screenshot:analyze', payload),
    analyzeContext: (payload: unknown) => ipcRenderer.invoke('context:analyze', payload),
    transcribeAudio: (payload: unknown) => ipcRenderer.invoke('voice:transcribe', payload),
    generateImage: (payload: unknown) => ipcRenderer.invoke('image:generate', payload),
    ingestFiles: (paths: string[]) => ipcRenderer.invoke('files:ingest', { paths }),
    selectAnalysisSources: () => ipcRenderer.invoke('files:select-analysis-sources'),
    getSettings: () => ipcRenderer.invoke('settings:get'),
    saveSettings: (payload: unknown) => ipcRenderer.invoke('settings:save', payload),
    getStartupSettings: () => ipcRenderer.invoke('startup:get'),
    setStartupEnabled: (enabled: boolean) => ipcRenderer.invoke('startup:set', Boolean(enabled)),
    getLanShareStatus: () => ipcRenderer.invoke('lan-share:get'),
    setLanShareEnabled: (enabled: boolean) => ipcRenderer.invoke('lan-share:set', Boolean(enabled)),
    selectWorkspaceRoot: () => ipcRenderer.invoke('permissions:select-workspace'),
    listModels: (payload: unknown) => ipcRenderer.invoke('models:list', payload),
    getWindowMode: () => ipcRenderer.invoke('window:get-mode'),
    setWindowMode: (mode: string) => ipcRenderer.invoke('window:set-mode', mode),
    beginCompactDrag: (point: unknown) => ipcRenderer.invoke('window:compact-drag-start', point),
    dragCompactWindow: (point: unknown) => ipcRenderer.invoke('window:compact-drag-move', point),
    endCompactDrag: () => ipcRenderer.invoke('window:compact-drag-end'),
    revealCompactWindow: () => ipcRenderer.invoke('window:compact-reveal'),
    hideCompactTools: () => ipcRenderer.invoke('window:compact-hide-tools'),
    setAnswerZoom: (enabled: boolean) => ipcRenderer.invoke('window:compact-answer-zoom', enabled),
    minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
    closeWindow: () => ipcRenderer.invoke('window:close'),
    togglePin: () => ipcRenderer.invoke('window:toggle-pin'),
    getPathForFile: (file: FileWithOptionalPath) => {
      try {
        return webUtils?.getPathForFile?.(file) || file?.path || '';
      } catch {
        return file?.path || '';
      }
    },
    onContextUpdated: (callback: BridgeCallback) => listen('context-updated', callback),
    onWindowModeChanged: (callback: BridgeCallback) => listen('window-mode-changed', callback),
    onScreenshotCreated: (callback: BridgeCallback) => listen('screenshot-created', callback),
    onScreenshotError: (callback: BridgeCallback) => listen('screenshot-error', callback),
    onLanShareReceived: (callback: BridgeCallback) => listen('lan-share-received', callback),
    onUpdateStatus: (callback: BridgeCallback) => listen('update-status', callback)
  };
}
