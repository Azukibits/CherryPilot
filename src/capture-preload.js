const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('captureBridge', {
  complete: (rect) => ipcRenderer.invoke('capture:complete', rect),
  cancel: () => ipcRenderer.invoke('capture:cancel'),
  onPrepare: (callback) => {
    if (typeof callback !== 'function') {
      return () => {};
    }

    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('capture:prepare', listener);
    return () => ipcRenderer.removeListener('capture:prepare', listener);
  }
});
