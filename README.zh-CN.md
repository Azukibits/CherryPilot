# CherryPilot 中文说明

CherryPilot 是一个悬浮式桌面 AI 助手。它可以读取截图、文档、语音、局域网共享内容和授权工作目录中的文件，然后结合上下文回答问题；也可以在你明确授权后创建项目、写文件、运行构建/调试命令。

## 应该用哪个 exe

给自己或别人正常安装，请用：

```text
dist/CherryPilot-Setup-0.1.0.exe
```

不要直接运行 `win-unpacked` 里的 exe，它只是打包过程产生的中间目录。`latest.yml` 和 `.blockmap` 也不是程序，它们是桌面自动更新需要的元数据；如果你要发布自动更新，需要和安装包一起上传到更新目录。

当前默认打包只生成安装版，不再生成 Portable 免安装版。

## 安装依赖

需要 Node.js 20 或更高版本。

```powershell
npm install
```

## 开发运行

```powershell
npm start
```

## Windows 打包

```powershell
npm run dist
```

输出文件：

```text
dist/CherryPilot-Setup-0.1.0.exe
dist/CherryPilot-Setup-0.1.0.exe.blockmap
dist/latest.yml
```

`npm run dist` 会先清理旧的 `dist`，避免旧的 exe 混在一起；构建后也会删除 `win-unpacked` 这类中间产物。

## 桌面自动更新

桌面自动更新只适用于安装版，也就是 `CherryPilot-Setup-<version>.exe`。

发布新版本时：

1. 修改 `package.json` 里的 `version`。
2. 运行 `npm run dist`。
3. 把下面三个文件上传到同一个更新目录：

```text
latest.yml
CherryPilot-Setup-<version>.exe
CherryPilot-Setup-<version>.exe.blockmap
```

更新地址在 `src/update-config.json` 里配置，也可以用运行环境变量 `CHERRYPILOT_UPDATE_URL` 覆盖。

## Android APK

需要 Android Studio / Android SDK 和 JDK。当前机器如果没有 `JAVA_HOME` 或 PATH 里没有 `java`，APK 构建会失败。

同步 Android 资源：

```powershell
npm run android:sync
```

构建 debug APK：

```powershell
npm run apk:debug
```

输出位置：

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

APK 是 Capacitor WebView 版本，可以使用核心问答、模型和部分移动端桥接能力；桌面悬浮窗、置顶窗口、原生区域截图、工作目录命令工具和局域网服务端等桌面能力不属于 APK 功能。

## 常用功能

- 悬浮图标：单击展开小问答框，双击打开主界面。
- 区域截图：截图后会显示预览，可以删除；删除后不会再作为上下文发送。
- 文档上下文：支持拖入或选择 PDF、DOCX、Markdown、代码文件等。
- 多接口：支持多个 OpenAI-compatible 接口，也支持 Ollama / LM Studio 这类本地模型地址。
- 工作目录授权：AI 只能在你授权的目录里读写文件。
- 命令权限：默认关闭，只有单独开启后才允许运行构建、测试、调试等命令。
- 局域网共享：同一局域网设备可以通过浏览器页面发送文字或文件给 CherryPilot。

## 安全建议

建议只授权专门的工作文件夹，不要授权桌面、下载目录、用户主目录或包含密钥的仓库。命令权限只在确实需要构建、调试或发布时打开。

## 语法检查

```powershell
npm run lint
npm run typecheck
npm run build
node --check dist-electron/main.cjs
node --check dist-electron/preload.cjs
node --check dist-electron/capture-preload.cjs
node --check scripts/sync-android-version.js
node --check scripts/clean-dist.js
```
