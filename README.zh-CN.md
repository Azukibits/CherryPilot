# CherryPilot

[English](README.md) | [简体中文](README.zh-CN.md)

> 一个悬浮式桌面 AI Pilot，用于截图、文件、语音、本地/云端模型，以及受控的工作区自动化。

CherryPilot 是一个 Electron 桌面助手，会以悬浮小图标常驻在工作区上方。它可以基于区域截图、当前窗口标题、拖入文件、语音命令和 OpenAI-compatible 接口回答问题。用户明确授权后，它也可以在指定工作区内读写文件，并运行受限的开发命令。

![CherryPilot 图标](src/assets/cherrypilot.png)

![Electron](https://img.shields.io/badge/Electron-42-47848F?logo=electron)
![Vue](https://img.shields.io/badge/Vue-3-42b883?logo=vuedotjs)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript)
![License](https://img.shields.io/badge/license-MIT-green)

## 功能

- 悬浮助手支持三种快速模式：贴边图标、单击紧凑问答框、双击主面板。
- 支持置顶、拖拽、贴边停靠和展开设置面板。
- 区域截图，发送前可预览或删除。
- 文件上下文读取，支持 PDF、DOCX、Markdown、日志、JSON、HTML/CSS/JS/TS、Python、Java、C/C++ 和纯文本。
- 语音唤醒、语音转写、语音提问和语音生图命令。
- 多个 OpenAI-compatible 接口槽位，也支持 Ollama / LM Studio 这类本地服务。
- 模型列表刷新，以及紧凑面板内快速切换模型。
- 紧凑问答框支持流式回答输出，并在紧凑历史面板中保存问答记录。
- 可选的工作区授权，用于 AI 读写文件和创建项目。
- 独立的命令权限开关，用于受控运行构建、调试、测试和发布命令。
- 类 AirDrop 的局域网设备互传：发现附近 CherryPilot 设备、校验设备身份、接收端确认，并使用一次性传输票据发送文件。
- 低 CPU 模式和开机自启动设置。
- 基于 `electron-updater` 的桌面自动更新。

## 环境要求

- Node.js 20 或更高版本。
- Windows 用于默认 NSIS 安装包目标。
- macOS DMG 目标需要在 macOS 或 macOS CI 上构建。

## 快速开始

```powershell
npm install
npm start
```

`npm start` 会先构建 Vite 渲染进程和 Electron 主进程，然后启动桌面应用。

## 常见问题

### API Key 或模型报错

打开主面板，填写接口 API Key、Base URL 和模型名，然后保存配置。本地模型常用地址：

```text
http://127.0.0.1:11434/v1
```

### 截图无法启动

确认没有其他截图窗口正在打开，然后重新点击截图按钮或使用全局快捷键。Windows 打包版如果被安全软件限制，可能需要放行屏幕捕获权限。

### 工作区工具不可用

先选择并授权一个工作区目录。命令执行还需要单独打开命令权限开关。

### 局域网设备不显示

局域网共享是应用对应用发现。另一台设备也必须运行 CherryPilot、开启局域网共享，并且处在同一个本地子网。

如果附近设备列表一直为空：

- 查看设置里的 LAN 诊断行。本机应显示 `192.168.x.x`、`10.x.x.x` 或 `172.16-31.x.x` 这类私有地址。
- 在系统防火墙中放行 CherryPilot。设备发现使用 UDP `49328`，文件接收使用诊断行显示的 HTTP 端口。
- 关闭路由器上的访客 Wi-Fi 隔离、客户端隔离或 AP 隔离。
- 如果 VPN 或虚拟网卡把两台设备放到了不同子网，先临时断开再测试。

应用内互传时，发现广播不会携带接收 token。发送端会先校验 `/device-info`，接收端确认请求后，CherryPilot 才生成 60 秒有效的一次性票据用于真正上传。

### 构建产物看起来是旧的

```powershell
npm run clean:dist
npm run build
```

## 从源码构建

类型检查、代码规范检查和构建：

```powershell
npm run lint
npm run typecheck
npm run build
```

Windows 解包版本：

```powershell
npm run pack
```

Windows 安装包：

```powershell
npm run dist
```

预期输出：

```text
dist/CherryPilot-Setup-0.1.0.exe
dist/CherryPilot-Setup-0.1.0.exe.blockmap
dist/latest.yml
```

macOS DMG：

```powershell
npm run dist:mac
```

macOS 目标请在 macOS 或 macOS CI 上运行。

## 桌面自动更新

CherryPilot 会在打包后的桌面版中检查更新。更新地址可以在 `src/update-config.json` 中配置，也可以用运行时环境变量 `CHERRYPILOT_UPDATE_URL` 覆盖。

使用 generic 更新源时，把下面三个文件放到同一个更新目录：

```text
latest.yml
CherryPilot-Setup-<version>.exe
CherryPilot-Setup-<version>.exe.blockmap
```

每次发布前记得更新 `package.json` 里的 `version`。

## 工作区安全

建议只授权专门的工作区目录。不要授权桌面、下载目录、用户主目录，或包含密钥的仓库。

应用会阻止直接打开 `.exe`、`.bat`、`.cmd`、`.ps1`、`.reg` 等可执行/脚本类型。命令工具默认关闭，并且只允许白名单内的开发命令。

## 项目结构

```text
src/main/main.ts                  Electron 应用生命周期
src/main/window-manager.ts        窗口模式、紧凑停靠、拖拽和边界
src/main/ipc-handlers.ts          渲染进程到主进程的 IPC 处理
src/main/lan-share.ts             局域网发现、设备校验、接收确认和文件传输
src/main/ai/                      AI 接口、聊天流式输出、生图、语音和电脑工具
src/main/preload/                 主窗口桥接 API
src/main/capture-preload.ts       截图窗口桥接 API
src/renderer/App.vue              Vue 3 渲染进程生命周期壳
src/renderer/components/          紧凑外壳、设置、历史、Provider 和面板组件
src/renderer/composables/         共享状态、问答流程、设置、文案和生命周期 hooks
src/renderer/views/               主窗口视图
src/renderer/main.ts              Vue/Vite 渲染入口
src/capture/main.ts               截图交互
src/index.html                    主窗口 HTML 壳
src/capture.html                  截图窗口 HTML 壳
src/styles.css                    共享 UI 样式
src/assets/                       应用图标
vite.renderer.config.ts           Vite 渲染进程构建配置
vite.main.config.ts               Vite Electron 主进程/preload 构建配置
scripts/                          工具脚本
```

## 状态

CherryPilot 仍处于早期桌面应用阶段。当前优先级是保持 Electron 桌面体验稳定，并继续完善紧凑问答流程、流式回答和安全的局域网传输。

## 许可证

MIT
