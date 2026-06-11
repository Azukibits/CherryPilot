export interface CompanionLanShareState {
  lanShare: {
    enabled: boolean;
    port: number;
    token: string;
    deviceId: string;
    urls: string[];
    deviceName: string;
    diagnostics: CompanionLanShareDiagnostics;
    devices: CompanionLanShareDevice[];
  };
}

/**
 * 创建局域网共享业务的默认状态。
 * token、设备列表和可访问 URL 都来自主进程，不在初始化阶段写入。
 */
export function createCompanionLanShareState(): CompanionLanShareState {
  return {
    lanShare: {
      enabled: false,
      port: 0,
      token: '',
      deviceId: '',
      urls: [],
      deviceName: '',
      diagnostics: {},
      devices: []
    }
  };
}
