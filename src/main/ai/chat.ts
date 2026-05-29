// @ts-nocheck
// 上下文分析服务
// 负责构造系统提示词、附件内容和工具调用循环，最终返回 AI 分析结果。
import { DEFAULT_SETTINGS, LAST_PROVIDER_INDEX, MAX_ATTACHMENT_CHARS, MAX_DIRECTORY_ATTACHMENT_CHARS, MAX_TOOL_ITERATIONS, MAX_TOOL_OUTPUT_CHARS } from '@/main/entity';
import { readSettings } from '@/main/settings';
import { getAuthHeaders, getChatCompletionsUrl, isLocalBaseUrl } from '@/main/ai/provider-client';
import { COMPUTER_TOOLS, executeComputerTool, truncateToolOutput } from '@/main/ai/computer-tools';

function buildAttachmentText(attachments = []) {
  const valid = attachments.filter((item) => item && item.text);

  if (valid.length === 0) {
    return '附件：无';
  }

  return [
    `附件：${valid.length} 个`,
    ...valid.map((item, index) => {
      const maxChars = item.type === 'directory' ? MAX_DIRECTORY_ATTACHMENT_CHARS : MAX_ATTACHMENT_CHARS;
      return [
        `--- 附件 ${index + 1}: ${item.name || '未命名'} ---`,
        String(item.text).slice(0, maxChars)
      ].join('\n');
    })
  ].join('\n\n');
}

function buildAnalysisPrompt({ activeTitle, note, attachments }) {
  const titleLine = activeTitle ? `当前窗口标题：${activeTitle}` : '当前窗口标题：未知';
  const noteLine = note ? `用户要求：${note}` : '用户要求：请根据当前截图/附件给出有用结论和下一步建议。';

  return [
    titleLine,
    noteLine,
    buildAttachmentText(attachments),
    '',
    '请用中文回答。优先结合用户要求；如果有截图，请观察截图内容；如果有附件，请总结、提炼重点或按要求分析。',
    '不要编造截图或附件中没有的信息。输出要直接、可执行。'
  ].join('\n');
}

function buildSystemPrompt(settings) {
  const lines = [
    '你是一个常驻桌面的 AI companion，能根据截图、附件和用户要求提供简洁、准确、可执行的中文帮助。'
  ];

  if (settings.computerAccess?.enabled) {
    lines.push(
      '用户已经授权你使用电脑工具。只能在已授权的工作目录内读写文件、创建目录、运行命令。',
      '需要创建代码项目、文档、读取资源、调试或发布时，优先使用工具完成实际操作，然后汇报关键结果。',
      '生成或修改 cpp、py、md、项目目录等文件后，如果用户希望直接打开，请使用工具把授权目录内的目标路径交给系统默认 IDE 或应用打开。',
      '命令工具只接受白名单开发命令，不支持 shell 管道、重定向、拼接命令或危险删除操作。',
      '不要尝试访问授权目录之外的路径；命令执行只用于构建、测试、调试、安装依赖或发布相关任务。'
    );
  }

  return lines.join('\n');
}

async function postChatCompletion(baseUrl, apiKey, body) {
  const response = await fetch(getChatCompletionsUrl(baseUrl), {
    method: 'POST',
    headers: {
      ...getAuthHeaders(apiKey, baseUrl),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = payload.error?.message || `AI 璇锋眰澶辫触锛欻TTP ${response.status}`;
    throw new Error(message);
  }

  return payload;
}

function extractAssistantMessage(payload) {
  const message = payload.choices?.[0]?.message;
  if (!message) {
    throw new Error('AI 杩斿洖涓虹┖');
  }

  return message;
}

async function runChatCompletion({ baseUrl, apiKey, model, messages, settings }) {
  const body = {
    model,
    temperature: 0.2,
    messages
  };

  if (!settings.computerAccess?.enabled) {
    const payload = await postChatCompletion(baseUrl, apiKey, body);
    const message = extractAssistantMessage(payload);
    const content = message.content;

    if (!content) {
      throw new Error('AI 杩斿洖涓虹┖');
    }

    return {
      content,
      model,
      analyzedAt: new Date().toISOString()
    };
  }

  const toolMessages = messages.slice();

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration += 1) {
    const payload = await postChatCompletion(baseUrl, apiKey, {
      ...body,
      messages: toolMessages,
      tools: COMPUTER_TOOLS,
      tool_choice: 'auto'
    });
    const message = extractAssistantMessage(payload);
    const toolCalls = Array.isArray(message.tool_calls) ? message.tool_calls : [];

    if (toolCalls.length === 0) {
      const content = message.content;
      if (!content) {
        throw new Error('AI 杩斿洖涓虹┖');
      }

      return {
        content,
        model,
        analyzedAt: new Date().toISOString()
      };
    }

    toolMessages.push({
      role: 'assistant',
      content: message.content || '',
      tool_calls: toolCalls
    });

    for (const toolCall of toolCalls) {
      const result = await executeComputerTool(settings, toolCall);
      toolMessages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        name: toolCall.function?.name || '',
        content: truncateToolOutput(JSON.stringify(result), MAX_TOOL_OUTPUT_CHARS)
      });
    }
  }

  throw new Error('工具调用次数过多，已停止执行');
}

// 组合截图、附件和用户问题后调用聊天模型分析。
export async function analyzeContext({ imageDataUrl, activeTitle, note, attachments }) {
  if (!imageDataUrl && (!attachments || attachments.length === 0) && !note) {
    throw new Error('请先截图、拖入文件，或输入要求');
  }

  const settings = await readSettings();
  const activeProviderIndex = Math.min(LAST_PROVIDER_INDEX, Math.max(0, Number(settings.activeProviderIndex || 0)));
  const chatProvider = settings.providers?.[activeProviderIndex] || settings.providers?.[0] || settings;
  const baseUrl = chatProvider.baseUrl || process.env.AI_BASE_URL || DEFAULT_SETTINGS.baseUrl;
  const apiKey = chatProvider.apiKey || (!isLocalBaseUrl(baseUrl) ? process.env.AI_API_KEY || process.env.OPENAI_API_KEY : '');
  const model = chatProvider.model || process.env.AI_MODEL || DEFAULT_SETTINGS.model;

  if (!apiKey && !isLocalBaseUrl(baseUrl)) {
    throw new Error('请先在接口设置里填写 API Key');
  }

  const userContent = [
    {
      type: 'text',
      text: buildAnalysisPrompt({ activeTitle, note, attachments })
    }
  ];

  if (imageDataUrl && imageDataUrl.startsWith('data:image/')) {
    userContent.push({
      type: 'image_url',
      image_url: { url: imageDataUrl }
    });
  }

  const messages = [
    {
      role: 'system',
      content: buildSystemPrompt(settings)
    },
    {
      role: 'user',
      content: userContent
    }
  ];

  return runChatCompletion({ baseUrl, apiKey, model, messages, settings });
}

// 保留截图分析 IPC 的语义入口，内部复用上下文分析。
export async function analyzeScreenshot(payload) {
  return analyzeContext(payload);
}
