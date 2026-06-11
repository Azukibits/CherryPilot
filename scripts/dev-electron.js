const { spawn } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const https = require('node:https');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const isWindows = process.platform === 'win32';
const nodeCmd = process.execPath;
const viteCli = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');
const electronCmd = isWindows
  ? path.join(root, 'node_modules', 'electron', 'dist', 'electron.exe')
  : path.join(root, 'node_modules', '.bin', 'electron');
const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:5173';
const mainEntry = path.join(root, 'dist-electron', 'main.cjs');
const devServer = new URL(devServerUrl);

const children = new Set();
let shuttingDown = false;

function run(command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: false,
    ...options
  });

  children.add(child);
  child.on('exit', (code) => {
    children.delete(child);
    if (!shuttingDown && code && code !== 0) {
      shutdown(code);
    }
  });

  return child;
}

function shutdown(code = 0) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  for (const child of children) {
    child.kill();
  }
  process.exitCode = code;
}

function waitForMainBuild() {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const timer = setInterval(() => {
      const stats = fs.existsSync(mainEntry) ? fs.statSync(mainEntry) : null;
      if (stats && stats.mtimeMs >= startedAt) {
        clearInterval(timer);
        resolve();
      } else if (Date.now() - startedAt > 30000) {
        clearInterval(timer);
        console.error('Timed out waiting for dist-electron/main.cjs');
        shutdown(1);
      }
    }, 250);
  });
}

function waitForDevServer() {
  const client = devServer.protocol === 'https:' ? https : http;

  return new Promise((resolve) => {
    const startedAt = Date.now();
    const timer = setInterval(() => {
      const request = client.get(devServerUrl, (response) => {
        response.resume();
        clearInterval(timer);
        resolve();
      });

      request.on('error', () => {
        if (Date.now() - startedAt > 30000) {
          clearInterval(timer);
          console.error(`Timed out waiting for ${devServerUrl}`);
          shutdown(1);
        }
      });
      request.setTimeout(1000, () => request.destroy());
    }, 250);
  });
}

async function main() {
  run(nodeCmd, [viteCli, 'build', '--config', 'vite.main.config.ts', '--watch']);
  run(nodeCmd, [
    viteCli,
    '--config',
    'vite.renderer.config.ts',
    '--host',
    devServer.hostname,
    '--port',
    devServer.port || '5173',
    '--strictPort'
  ]);

  await waitForMainBuild();
  await waitForDevServer();
  if (shuttingDown) {
    return;
  }

  const electronProcess = run(electronCmd, ['.'], {
    env: {
      ...process.env,
      VITE_DEV_SERVER_URL: devServerUrl
    }
  });

  electronProcess.on('exit', (code) => {
    shutdown(code || 0);
  });
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

main().catch((error) => {
  console.error(error);
  shutdown(1);
});
