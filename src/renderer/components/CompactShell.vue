<script setup lang="ts">
import CherryMark from './CherryMark.vue';
</script>

<template>
  <section class="compact-shell" id="compactShell" aria-label="CherryPilot">
    <div class="compact-agent-zone">
      <button class="agent-icon" id="agentIcon" title="单击展开，双击打开主页面" aria-label="CherryPilot">
        <svg class="agent-mark" viewBox="0 0 48 48" aria-hidden="true">
          <CherryMark />
        </svg>
        <span class="status-dot"></span>
      </button>
      <div class="compact-orbit" aria-hidden="false">
        <button class="compact-action" id="compactModelButton" title="Switch model" aria-label="Switch model">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3 4 7l8 4 8-4z" />
            <path d="M4 12l8 4 8-4M4 17l8 4 8-4" />
          </svg>
        </button>
        <button class="compact-action" id="compactShotButton" title="区域截图 Ctrl+~" aria-label="区域截图">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 8h4l2-3h4l2 3h4v11H4z" />
            <circle cx="12" cy="13" r="3.4" />
          </svg>
        </button>
        <button class="compact-action" id="compactFileButton" title="添加文档" aria-label="添加文档">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
            <path d="M14 3v5h5M12 12v5M9.5 14.5H14.5" />
          </svg>
        </button>
        <button class="compact-action" id="compactMicButton" title="Voice input" aria-label="Voice input">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z" />
            <path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" />
          </svg>
        </button>
        <button class="compact-action" id="compactOpenButton" title="打开主界面" aria-label="打开主界面">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2 3-.2-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21h-3.4v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.2.1-2-3 .1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H4v-3.4h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 2-3 .2.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5V3h3.4v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.2-.1 2 3-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.2v3.4h-.2a1.7 1.7 0 0 0-1.5 1z" />
          </svg>
        </button>
        <button class="compact-action compact-context-action" id="compactExitButton" title="Exit CherryPilot" aria-label="Exit CherryPilot">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3v9M6.6 6.8a8 8 0 1 0 10.8 0" />
          </svg>
        </button>
      </div>
    </div>

    <div class="compact-tools" id="compactTools">
      <div class="compact-topline" hidden>
        <span class="compact-context" id="compactContextStatus">无上下文</span>
      </div>
      <div class="compact-input-row">
        <input id="compactPromptInput" type="text" spellcheck="false" placeholder="直接提问..." />
        <button class="compact-send" id="compactSendButton" title="发送" aria-label="发送">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" />
          </svg>
        </button>
        <button class="compact-history-button" id="compactHistoryButton" title="History" aria-label="History">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 5v5h5" />
            <path d="M5.4 15a7 7 0 1 0 1-7.4L4 10" />
            <path d="M12 8v5l3 2" />
          </svg>
        </button>
      </div>
      <div class="compact-screenshot-strip" id="compactScreenshotStrip" hidden>
        <button class="compact-screenshot-thumb" id="compactScreenshotPreviewButton" title="预览截图" aria-label="预览截图">
          <img id="compactScreenshotThumb" alt="截图预览" />
          <span>截图</span>
        </button>
        <button class="compact-screenshot-delete" id="compactScreenshotDeleteButton" title="删除截图" aria-label="删除截图">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 6h18M8 6V4h8v2M7 6l1 15h8l1-15" />
          </svg>
        </button>
      </div>
      <div class="compact-model-panel" id="compactModelPanel" hidden></div>
      <div class="compact-history-panel" id="compactHistoryPanel" hidden>
        <div class="panel-row">
          <h2>History</h2>
          <button class="ghost-button" id="clearHistoryButton" title="Clear history" aria-label="Clear history">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 6h18M8 6V4h8v2M7 6l1 15h8l1-15" />
            </svg>
            <span>Clear</span>
          </button>
        </div>
        <div class="history-list" id="historyList"></div>
      </div>
      <button class="answer-expand-button" id="compactAnswerExpandButton" title="Expand answer" aria-label="Expand answer">
        <svg class="expand-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8 3H3v5M16 21h5v-5M3 3l7 7M21 21l-7-7" />
        </svg>
        <svg class="restore-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M10 3v5H5M14 21v-5h5M5 8l5-5M19 16l-5 5" />
        </svg>
      </button>
      <div class="compact-answer" id="compactAnswerBox">等待提问</div>
      <div class="compact-screenshot-preview" id="compactScreenshotPreviewPanel" hidden>
        <div class="compact-screenshot-preview-bar">
          <strong>截图预览</strong>
          <div>
            <button class="history-icon-button" id="compactScreenshotPreviewDeleteButton" title="删除截图" aria-label="删除截图">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3 6h18M8 6V4h8v2M7 6l1 15h8l1-15" />
              </svg>
            </button>
            <button class="history-icon-button" id="compactScreenshotPreviewCloseButton" title="关闭预览" aria-label="关闭预览">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
        </div>
        <img id="compactScreenshotPreviewImage" alt="截图预览" />
      </div>
    </div>
  </section>
</template>
