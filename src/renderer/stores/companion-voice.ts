export interface CompanionVoiceState {
  isRecording: boolean;
  voiceProcessing: boolean;
  mediaRecorder: MediaRecorder | null;
  voiceStream: MediaStream | null;
  voiceChunks: Blob[];
  voiceAwake: boolean;
  voiceSegmentTimer: ReturnType<typeof setTimeout> | null;
  voiceRestartTimer: ReturnType<typeof setTimeout> | null;
  voiceMimeType: string;
}

/**
 * 创建语音输入业务的默认状态。
 * MediaRecorder、MediaStream 和定时器都是运行时资源，初始化时必须为空。
 */
export function createCompanionVoiceState(): CompanionVoiceState {
  return {
    isRecording: false,
    voiceProcessing: false,
    mediaRecorder: null,
    voiceStream: null,
    voiceChunks: [],
    voiceAwake: false,
    voiceSegmentTimer: null,
    voiceRestartTimer: null,
    voiceMimeType: ''
  };
}
