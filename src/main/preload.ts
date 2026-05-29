// preload 入口
// 仅负责把拆分后的 companion bridge 暴露到 window，桥接方法在 preload/companion-bridge.ts 中维护。
import { contextBridge } from 'electron';
import { createCompanionBridge } from '@/main/preload/companion-bridge';

contextBridge.exposeInMainWorld('companion', createCompanionBridge());
