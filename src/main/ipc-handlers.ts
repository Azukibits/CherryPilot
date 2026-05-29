// IPC 桥接处理注册
// 把 preload 暴露的方法按业务映射到主进程服务，main.ts 只负责调用注册入口。
import { ipcMain } from 'electron';
import { refreshActiveWindowTitle } from '@/main/active-context';
import { analyzeContext, analyzeScreenshot } from '@/main/ai/chat';
import { selectWorkspaceRoot } from '@/main/ai/computer-tools';
import { generateImage } from '@/main/ai/image';
import { listModels } from '@/main/ai/provider-client';
import { transcribeAudio } from '@/main/ai/voice';
import { ingestFiles, selectAnalysisSources } from '@/main/file-service';
import { getLanShareStatus, setLanShareEnabled } from '@/main/lan-share';
import { cancelRegionCapture, completeRegionCapture, startRegionCapture } from '@/main/screen-capture';
import { readSettings, saveSettings, getStartupSettings, setStartupSettings } from '@/main/settings';
import {
  beginCompactDrag,
  dragCompactWindow,
  emitWindowMode,
  endCompactDrag,
  hideCompactTools,
  revealCompactWindow,
  setCompactAnswerZoom,
  setWindowMode
} from '@/main/window-manager';
import { mainState } from '@/main/state';

// 注册 renderer 通过 preload 调用的全部业务 IPC。
export function registerIpcHandlers() {
  ipcMain.handle('active-context:get', () => refreshActiveWindowTitle({ force: true }));
  ipcMain.handle('screen:select-region', () => startRegionCapture());
  ipcMain.handle('screenshot:analyze', (_event, payload) => analyzeScreenshot(payload));
  ipcMain.handle('context:analyze', (_event, payload) => analyzeContext(payload));
  ipcMain.handle('files:ingest', (_event, payload) => ingestFiles(payload?.paths || []));
  ipcMain.handle('files:select-analysis-sources', () => selectAnalysisSources());
  ipcMain.handle('settings:get', () => readSettings());
  ipcMain.handle('settings:save', (_event, payload) => saveSettings(payload));
  ipcMain.handle('startup:get', () => getStartupSettings());
  ipcMain.handle('startup:set', (_event, enabled) => setStartupSettings(enabled));
  ipcMain.handle('lan-share:get', () => getLanShareStatus());
  ipcMain.handle('lan-share:set', (_event, enabled) => setLanShareEnabled(Boolean(enabled)));
  ipcMain.handle('permissions:select-workspace', () => selectWorkspaceRoot());
  ipcMain.handle('models:list', (_event, payload) => listModels(payload));
  ipcMain.handle('voice:transcribe', (_event, payload) => transcribeAudio(payload));
  ipcMain.handle('image:generate', (_event, payload) => generateImage(payload));
  ipcMain.handle('window:get-mode', () => emitWindowMode());
  ipcMain.handle('window:set-mode', (_event, mode) => setWindowMode(mode));
  ipcMain.handle('window:compact-drag-start', (_event, point) => beginCompactDrag(point));
  ipcMain.handle('window:compact-drag-move', (_event, point) => dragCompactWindow(point));
  ipcMain.handle('window:compact-drag-end', () => endCompactDrag());
  ipcMain.handle('window:compact-reveal', () => revealCompactWindow());
  ipcMain.handle('window:compact-hide-tools', () => hideCompactTools());
  ipcMain.handle('window:compact-answer-zoom', (_event, enabled) => setCompactAnswerZoom(Boolean(enabled)));
  ipcMain.handle('capture:complete', (_event, rect) => completeRegionCapture(rect));
  ipcMain.handle('capture:cancel', () => cancelRegionCapture());

  ipcMain.handle('window:minimize', () => {
    mainState.mainWindow?.minimize();
  });

  ipcMain.handle('window:close', () => {
    mainState.mainWindow?.close();
  });

  ipcMain.handle('window:toggle-pin', () => {
    if (!mainState.mainWindow) {
      return false;
    }

    const next = !mainState.mainWindow.isAlwaysOnTop();
    mainState.mainWindow.setAlwaysOnTop(next, 'floating');
    return next;
  });
}
