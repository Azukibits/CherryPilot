// @ts-nocheck
// 局域网分享服务
// 提供本机局域网网页入口，接收文本和文件后转发给渲染层。
import path from 'node:path';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import crypto from 'node:crypto';
import { app } from 'electron';
import { MAX_ATTACHMENT_BYTES, MAX_ATTACHMENT_CHARS, MAX_LAN_BODY_BYTES, MAX_LAN_FILES } from '@/main/entity';
import { mainState } from '@/main/state';
import { extractFileText } from '@/main/file-service';
import { readSettings, saveSettings } from '@/main/settings';

function getLanAddresses() {
  const addresses = [];
  const interfaces = os.networkInterfaces();

  for (const details of Object.values(interfaces)) {
    for (const item of details || []) {
      if (item.family === 'IPv4' && !item.internal) {
        addresses.push(item.address);
      }
    }
  }

  return [...new Set(addresses)];
}

function getLanSharePublicState() {
  if (!mainState.lanShareState) {
    return {
      enabled: false,
      port: 0,
      token: '',
      urls: []
    };
  }

  return {
    ...mainState.lanShareState,
    urls: getLanAddresses().map((address) => `http://${address}:${mainState.lanShareState.port}/?token=${mainState.lanShareState.token}`)
  };
}

function sendLanJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  response.end(JSON.stringify(payload));
}

function getLanPage(token) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>CherryPilot LAN Share</title>
<style>
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#0b1016;color:#eef6f6}
main{max-width:720px;margin:0 auto;padding:24px}
h1{font-size:22px;margin:0 0 6px}
p{color:#9eb0bc;line-height:1.5}
textarea,input,button{width:100%;box-sizing:border-box;border-radius:8px;border:1px solid #2e3a45;background:#111922;color:#eef6f6}
textarea{min-height:140px;padding:12px;resize:vertical}
input{padding:10px;margin:12px 0}
button{height:40px;border-color:#43f0ce;background:#174137;color:#a8fff3;font-weight:700}
#status{margin-top:12px;color:#8affea}
</style>
</head>
<body>
<main>
<h1>CherryPilot LAN Share</h1>
<p>Send text or files to the CherryPilot device on this local network. Text-readable files become context for Q&A.</p>
<textarea id="message" placeholder="Notes, question context, links, or shared material"></textarea>
<input id="files" type="file" multiple />
<button id="send">Send to CherryPilot</button>
<div id="status"></div>
</main>
<script>
const token=${JSON.stringify(token)};
const statusEl=document.getElementById('status');
function toBase64(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]||'');reader.onerror=reject;reader.readAsDataURL(file);});}
document.getElementById('send').addEventListener('click',async()=>{try{statusEl.textContent='Preparing...';const files=Array.from(document.getElementById('files').files||[]).slice(0,8);const payload={message:document.getElementById('message').value,files:[]};for(const file of files){if(file.size>8*1024*1024){throw new Error(file.name+' is larger than 8 MB');}payload.files.push({name:file.name,type:file.type,size:file.size,data:await toBase64(file)});}const res=await fetch('/share?token='+encodeURIComponent(token),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const data=await res.json();if(!res.ok)throw new Error(data.error||'Send failed');statusEl.textContent='Sent '+data.count+' item(s).';}catch(error){statusEl.textContent=error.message||'Send failed';}});
</script>
</body>
</html>`;
}

function readLanBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;

    request.on('data', (chunk) => {
      total += chunk.length;
      if (total > MAX_LAN_BODY_BYTES) {
        reject(new Error('Request is too large'));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });

    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    request.on('error', reject);
  });
}

function sanitizeLanFileName(name = 'shared-file') {
  const cleaned = path.basename(String(name || 'shared-file')).replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').slice(0, 120);
  return cleaned || 'shared-file';
}

async function saveLanFile(file = {}) {
  const inbox = path.join(app.getPath('userData'), 'lan-inbox');
  await fs.mkdir(inbox, { recursive: true });

  const safeName = `${Date.now()}-${crypto.randomBytes(3).toString('hex')}-${sanitizeLanFileName(file.name)}`;
  const target = path.join(inbox, safeName);
  const buffer = Buffer.from(String(file.data || ''), 'base64');

  if (buffer.length > MAX_ATTACHMENT_BYTES) {
    throw new Error(`${file.name || 'file'} is larger than 8 MB`);
  }

  await fs.writeFile(target, buffer);
  return target;
}

async function handleLanSharePayload(payload = {}, request) {
  const results = [];
  const from = request.socket.remoteAddress || '';
  const message = String(payload.message || '').trim();

  if (message) {
    results.push({
      id: `${Date.now()}-lan-message`,
      name: 'LAN note',
      type: 'text',
      size: Buffer.byteLength(message, 'utf8'),
      text: message,
      preview: message.slice(0, 260),
      source: 'lan',
      from
    });
  }

  const files = Array.isArray(payload.files) ? payload.files.slice(0, MAX_LAN_FILES) : [];
  for (const file of files) {
    try {
      const savedPath = await saveLanFile(file);
      const item = await extractFileText(savedPath);
      results.push({
        ...item,
        id: `${Date.now()}-${results.length}-${item.name}`,
        name: file.name || item.name,
        text: item.text.slice(0, MAX_ATTACHMENT_CHARS),
        preview: item.text.slice(0, 260),
        source: 'lan',
        from
      });
    } catch (error) {
      results.push({
        id: `${Date.now()}-${results.length}-${sanitizeLanFileName(file?.name)}`,
        name: file?.name || 'LAN file',
        source: 'lan',
        from,
        error: error.message || 'LAN file read failed'
      });
    }
  }

  if (mainState.mainWindow && !mainState.mainWindow.isDestroyed() && results.length > 0) {
    mainState.mainWindow.webContents.send('lan-share-received', {
      receivedAt: new Date().toISOString(),
      from,
      items: results
    });
  }

  return results;
}

async function handleLanRequest(request, response, token) {
  try {
    const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
    const providedToken = url.searchParams.get('token') || '';

    if (providedToken !== token) {
      sendLanJson(response, 403, { ok: false, error: 'Invalid share token' });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/') {
      response.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff'
      });
      response.end(getLanPage(token));
      return;
    }

    if (request.method === 'POST' && url.pathname === '/share') {
      const raw = await readLanBody(request);
      const payload = JSON.parse(raw || '{}');
      const results = await handleLanSharePayload(payload, request);
      sendLanJson(response, 200, { ok: true, count: results.length });
      return;
    }

    sendLanJson(response, 404, { ok: false, error: 'Not found' });
  } catch (error) {
    sendLanJson(response, 400, { ok: false, error: error.message || 'LAN share failed' });
  }
}

// 启动局域网分享 HTTP 服务。
export async function startLanShare(config = {}) {
  if (mainState.lanShareServer && mainState.lanShareState) {
    return getLanSharePublicState();
  }

  const token = String(config.token || crypto.randomBytes(12).toString('hex'));
  const requestedPort = Math.max(0, Math.min(65535, Number(config.port || 0) || 0));

  mainState.lanShareServer = http.createServer((request, response) => {
    handleLanRequest(request, response, token);
  });

  await new Promise((resolve, reject) => {
    mainState.lanShareServer.once('error', reject);
    mainState.lanShareServer.listen(requestedPort, '0.0.0.0', () => {
      mainState.lanShareServer.off('error', reject);
      resolve();
    });
  });

  const address = mainState.lanShareServer.address();
  mainState.lanShareState = {
    enabled: true,
    port: typeof address === 'object' && address ? address.port : requestedPort,
    token
  };

  return getLanSharePublicState();
}

// 停止局域网分享 HTTP 服务并清空状态。
export async function stopLanShare() {
  const server = mainState.lanShareServer;
  mainState.lanShareServer = null;
  mainState.lanShareState = null;

  if (!server) {
    return getLanSharePublicState();
  }

  await new Promise((resolve) => server.close(() => resolve()));
  return getLanSharePublicState();
}

// 返回 LAN 分享当前对外可见状态。
export async function getLanShareStatus() {
  return getLanSharePublicState();
}

// 根据设置开关 LAN 分享，并把端口和 token 写回设置。
export async function setLanShareEnabled(enabled) {
  const settings = await readSettings();
  const state = enabled
    ? await startLanShare(settings.lanShare)
    : await stopLanShare();

  settings.lanShare = {
    enabled: state.enabled,
    port: state.port,
    token: state.token
  };
  await saveSettings(settings);
  return state;
}
