// @ts-nocheck
const { contextBridge, ipcRenderer, webUtils } = require('electron');

function listen(channel, callback) {
  if (typeof callback !== 'function') {
    return () => {};
  }

  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('companion', {
  getActiveContext: () => ipcRenderer.invoke('active-context:get'),
  selectRegion: () => ipcRenderer.invoke('screen:select-region'),
  analyzeScreenshot: (payload) => ipcRenderer.invoke('screenshot:analyze', payload),
  analyzeContext: (payload) => ipcRenderer.invoke('context:analyze', payload),
  transcribeAudio: (payload) => ipcRenderer.invoke('voice:transcribe', payload),
  generateImage: (payload) => ipcRenderer.invoke('image:generate', payload),
  ingestFiles: (paths) => ipcRenderer.invoke('files:ingest', { paths }),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (payload) => ipcRenderer.invoke('settings:save', payload),
  getStartupSettings: () => ipcRenderer.invoke('startup:get'),
  setStartupEnabled: (enabled) => ipcRenderer.invoke('startup:set', Boolean(enabled)),
  getLanShareStatus: () => ipcRenderer.invoke('lan-share:get'),
  setLanShareEnabled: (enabled) => ipcRenderer.invoke('lan-share:set', Boolean(enabled)),
  selectWorkspaceRoot: () => ipcRenderer.invoke('permissions:select-workspace'),
  listModels: (payload) => ipcRenderer.invoke('models:list', payload),
  getWindowMode: () => ipcRenderer.invoke('window:get-mode'),
  setWindowMode: (mode) => ipcRenderer.invoke('window:set-mode', mode),
  beginCompactDrag: (point) => ipcRenderer.invoke('window:compact-drag-start', point),
  dragCompactWindow: (point) => ipcRenderer.invoke('window:compact-drag-move', point),
  endCompactDrag: () => ipcRenderer.invoke('window:compact-drag-end'),
  revealCompactWindow: () => ipcRenderer.invoke('window:compact-reveal'),
  hideCompactTools: () => ipcRenderer.invoke('window:compact-hide-tools'),
  setAnswerZoom: (enabled) => ipcRenderer.invoke('window:compact-answer-zoom', enabled),
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  togglePin: () => ipcRenderer.invoke('window:toggle-pin'),
  getPathForFile: (file) => {
    try {
      return webUtils?.getPathForFile?.(file) || file?.path || '';
    } catch {
      return file?.path || '';
    }
  },
  onContextUpdated: (callback) => listen('context-updated', callback),
  onWindowModeChanged: (callback) => listen('window-mode-changed', callback),
  onScreenshotCreated: (callback) => listen('screenshot-created', callback),
  onScreenshotError: (callback) => listen('screenshot-error', callback),
  onLanShareReceived: (callback) => listen('lan-share-received', callback),
  onUpdateStatus: (callback) => listen('update-status', callback)
});
