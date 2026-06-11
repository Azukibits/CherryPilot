# CherryPilot

[English](README.md) | [简体中文](README.zh-CN.md)

> A floating desktop AI pilot for screenshots, files, voice input, local/cloud models, and guarded workspace automation.

CherryPilot is an Electron desktop companion that stays above your workspace as a compact floating icon. It can answer from selected screen regions, active-window context, dropped files, voice commands, and configured OpenAI-compatible providers. When explicitly authorized, it can also read/write inside a chosen workspace and run a narrow set of developer commands.

![CherryPilot icon](src/assets/cherrypilot.png)

![Electron](https://img.shields.io/badge/Electron-42-47848F?logo=electron)
![Vue](https://img.shields.io/badge/Vue-3-42b883?logo=vuedotjs)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript)
![License](https://img.shields.io/badge/license-MIT-green)

## Features

- Floating assistant with three fast modes: docked icon, single-click compact prompt, and double-click main panel.
- Pinning, drag, edge docking, and expanded settings panel controls.
- Region screenshots with preview/delete before the image is sent as context.
- File context ingestion for PDF, DOCX, Markdown, logs, JSON, HTML/CSS/JS/TS, Python, Java, C/C++ and plain text.
- Voice wake phrase flow, transcription, question answering, and image generation commands.
- Multiple OpenAI-compatible provider slots plus local Ollama / LM Studio style endpoints.
- Model list refresh and quick model switching from the compact panel.
- Streaming answer output in the compact prompt, with history stored in the compact history panel.
- Optional workspace authorization for AI file read/write and project creation.
- Separate command permission for guarded build/debug/test/publish commands.
- AirDrop-style LAN sharing between nearby CherryPilot devices, with device discovery, identity verification, receiver approval, and one-time transfer tickets.
- Low CPU mode and startup launch settings.
- Desktop auto-update support through `electron-updater`.

## Requirements

- Node.js 20 or newer.
- Windows for the default NSIS installer target.
- macOS only when building the macOS DMG target.

## Quick Install

```powershell
npm install
npm start
```

`npm start` builds the Vite renderer and Electron main process, then launches the desktop app.

## Troubleshooting

### API key or model errors

Open the main panel, fill in the provider API key, base URL, and model, then save settings. Local endpoints such as Ollama and LM Studio usually use:

```text
http://127.0.0.1:11434/v1
```

### Screenshot does not start

Make sure no capture window is already open, then retry the screenshot button or global shortcut. On Windows, packaged builds may need screen-capture permission from security software.

### Workspace tools are unavailable

Choose a workspace folder first. Command execution also requires the separate command-access toggle.

### LAN devices do not appear

LAN sharing is app-to-app discovery. The other device must also run CherryPilot, enable LAN sharing, and stay on the same local subnet.

If the nearby-device list stays empty:

- Check the LAN diagnostics line in Settings. It should show a private address such as `192.168.x.x`, `10.x.x.x`, or `172.16-31.x.x`.
- Allow CherryPilot through the OS firewall. Discovery uses UDP `49328`; file receiving uses the HTTP port shown in the diagnostics line.
- Disable guest Wi-Fi/client isolation/AP isolation on the router.
- Temporarily disconnect VPNs or virtual network adapters if they put the machines on different subnets.

For app-to-app transfer, discovery packets do not include the receiver token. The sender verifies `/device-info`, the receiver confirms the request, and CherryPilot uses a 60-second one-time ticket for the actual upload.

### Build artifacts look stale

```powershell
npm run clean:dist
npm run build
```

## Build From Source

Type-check, lint, and build:

```powershell
npm run lint
npm run typecheck
npm run build
```

Windows unpacked app:

```powershell
npm run pack
```

Windows installer:

```powershell
npm run dist
```

Expected installer output:

```text
dist/CherryPilot-Setup-0.1.0.exe
dist/CherryPilot-Setup-0.1.0.exe.blockmap
dist/latest.yml
```

macOS DMG:

```powershell
npm run dist:mac
```

Run the macOS target on macOS or a macOS CI runner.

## Desktop Auto Update

CherryPilot checks for updates in packaged desktop builds. Configure the update feed in `src/update-config.json`, or override it with `CHERRYPILOT_UPDATE_URL`.

For the generic updater, upload these files to the same update directory:

```text
latest.yml
CherryPilot-Setup-<version>.exe
CherryPilot-Setup-<version>.exe.blockmap
```

Bump `package.json` `version` before every release.

## Workspace Safety

Use a dedicated workspace folder. Avoid authorizing Desktop, Downloads, your home directory, or repositories containing secrets.

The app blocks direct opening of executable/script file types such as `.exe`, `.bat`, `.cmd`, `.ps1`, and `.reg`. Command tools are off by default and only allow whitelisted developer commands.

## Project Structure

```text
src/main/main.ts                  Electron app lifecycle
src/main/window-manager.ts        Window modes, compact docking, drag, and bounds
src/main/ipc-handlers.ts          Renderer-to-main IPC handlers
src/main/lan-share.ts             LAN discovery, device verification, approval, and file transfer
src/main/ai/                      AI providers, chat streaming, image, voice, and computer tools
src/main/preload/                 Main-window bridge API
src/main/capture-preload.ts       Capture-window bridge API
src/renderer/App.vue              Vue 3 renderer lifecycle shell
src/renderer/components/          Compact shell, settings, history, providers, and panels
src/renderer/composables/         Shared renderer state, assistant flow, settings, text, and lifecycle hooks
src/renderer/views/               Main window views
src/renderer/main.ts              Vue/Vite renderer entry
src/capture/main.ts               Capture interaction
src/index.html                    Main window HTML shell
src/capture.html                  Capture window HTML shell
src/styles.css                    Shared UI styles
src/assets/                       App icons
vite.renderer.config.ts           Vite renderer build config
vite.main.config.ts               Vite Electron main/preload build config
scripts/                          Utility scripts
```

## Status

CherryPilot is an early desktop app. The current priority is keeping the desktop Electron experience stable while improving the compact workflow, streaming responses, and secure local-network transfer.

## License

MIT
