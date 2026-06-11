// @ts-nocheck
// 局域网分享服务
// 提供本机局域网网页入口，接收文本和文件后转发给渲染层。
import path from 'node:path';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import crypto from 'node:crypto';
import dgram from 'node:dgram';
import { app, dialog } from 'electron';
import { MAX_ATTACHMENT_BYTES, MAX_ATTACHMENT_CHARS, MAX_LAN_BODY_BYTES, MAX_LAN_FILES } from '@/main/entity';
import { mainState } from '@/main/state';
import { extractFileText } from '@/main/file-service';
import { readSettings, saveSettings } from '@/main/settings';

const LAN_DISCOVERY_KIND = 'cherrypilot-lan-share';
const LAN_DISCOVERY_VERSION = 1;
const LAN_DISCOVERY_ADDRESS = '239.255.74.101';
const LAN_DISCOVERY_PORT = 49328;
const LAN_DISCOVERY_INTERVAL_MS = 2400;
const LAN_DEVICE_TTL_MS = 9000;
const LAN_TRANSFER_TICKET_TTL_MS = 60 * 1000;
let lanDeviceId = '';
const lanDevices = new Map();
const lanTransferTickets = new Map();
let lanDiscoverySocket = null;
let lanDiscoveryTimer = null;
let lanDiscoveryPruneTimer = null;

function getLanDeviceId() {
  if (!lanDeviceId) {
    lanDeviceId = crypto.randomUUID();
  }

  return lanDeviceId;
}

function setLanDeviceId(value = '') {
  const next = String(value || '').trim();
  lanDeviceId = next || lanDeviceId || crypto.randomUUID();
  return lanDeviceId;
}

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

function getLocalDeviceName() {
  return os.hostname() || 'CherryPilot';
}

function normalizeIpAddress(address = '') {
  const value = String(address || '').trim();
  if (value === '::1') {
    return '127.0.0.1';
  }
  return value.replace(/^::ffff:/i, '');
}

function isPrivateLanAddress(address = '') {
  const normalized = normalizeIpAddress(address).toLowerCase();

  if (!normalized) {
    return false;
  }

  if (normalized === '127.0.0.1' || normalized === 'localhost') {
    return true;
  }

  if (normalized.includes(':')) {
    return normalized.startsWith('fe80:')
      || normalized.startsWith('fd')
      || normalized.startsWith('fc');
  }

  const parts = normalized.split('.').map((part) => Number(part));

  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }

  const [a, b] = parts;
  return a === 10
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || (a === 169 && b === 254)
    || (a === 100 && b >= 64 && b <= 127);
}

function safeTokenMatches(provided = '', expected = '') {
  const providedBuffer = Buffer.from(String(provided || ''));
  const expectedBuffer = Buffer.from(String(expected || ''));

  if (providedBuffer.length === 0 || providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  try {
    return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

function getPublicLanDevices() {
  const now = Date.now();
  const devices = [];

  for (const [id, device] of lanDevices) {
    if (now - device.lastSeenAt > LAN_DEVICE_TTL_MS) {
      lanDevices.delete(id);
      continue;
    }

    devices.push({
      id,
      name: device.name,
      address: device.address,
      addresses: device.addresses,
      port: device.port,
      lastSeenAt: new Date(device.lastSeenAt).toISOString()
    });
  }

  return devices.sort((a, b) => a.name.localeCompare(b.name));
}

function emitLanDevicesChanged() {
  if (!mainState.mainWindow || mainState.mainWindow.isDestroyed()) {
    return;
  }

  mainState.mainWindow.webContents.send('lan-share-devices-changed', {
    devices: getPublicLanDevices()
  });
}

function pruneLanDevices() {
  const before = lanDevices.size;
  getPublicLanDevices();

  if (lanDevices.size !== before) {
    emitLanDevicesChanged();
  }
}

function chooseDeviceAddress(device = {}) {
  const candidates = [
    ...(Array.isArray(device.addresses) ? device.addresses : []),
    device.address
  ].map(normalizeIpAddress).filter(Boolean);

  return candidates.find(isPrivateLanAddress) || candidates[0] || '';
}

function handleLanDiscoveryMessage(message, remoteInfo) {
  try {
    const payload = JSON.parse(message.toString('utf8'));

    if (
      payload?.kind !== LAN_DISCOVERY_KIND
      || payload.version !== LAN_DISCOVERY_VERSION
      || !payload.id
      || payload.id === getLanDeviceId()
      || !payload.port
    ) {
      return;
    }

    const remoteAddress = normalizeIpAddress(remoteInfo?.address || '');
    const addresses = [
      ...(Array.isArray(payload.addresses) ? payload.addresses : []),
      remoteAddress
    ].map(normalizeIpAddress).filter(Boolean);
    const privateAddresses = [...new Set(addresses.filter(isPrivateLanAddress))];

    if (privateAddresses.length === 0) {
      return;
    }

    const id = String(payload.id);
    const current = lanDevices.get(id);
    const next = {
      id,
      name: String(payload.name || 'CherryPilot'),
      address: privateAddresses[0],
      addresses: privateAddresses,
      port: Number(payload.port),
      lastSeenAt: Date.now()
    };

    lanDevices.set(id, next);

    if (
      !current
      || current.name !== next.name
      || current.address !== next.address
      || current.port !== next.port
    ) {
      emitLanDevicesChanged();
    }
  } catch {
    // Ignore unrelated multicast traffic on the discovery port.
  }
}

function broadcastLanPresence() {
  if (!lanDiscoverySocket || !mainState.lanShareState?.enabled) {
    return;
  }

  const addresses = getLanAddresses();

  if (addresses.length === 0) {
    return;
  }

  const payload = Buffer.from(JSON.stringify({
    kind: LAN_DISCOVERY_KIND,
    version: LAN_DISCOVERY_VERSION,
    id: getLanDeviceId(),
    name: getLocalDeviceName(),
    port: mainState.lanShareState.port,
    addresses,
    sentAt: Date.now()
  }));

  let sent = false;

  for (const address of addresses) {
    try {
      lanDiscoverySocket.setMulticastInterface(address);
      lanDiscoverySocket.send(payload, 0, payload.length, LAN_DISCOVERY_PORT, LAN_DISCOVERY_ADDRESS);
      sent = true;
    } catch {
      // Try the next network interface.
    }
  }

  if (!sent) {
    lanDiscoverySocket.send(payload, 0, payload.length, LAN_DISCOVERY_PORT, LAN_DISCOVERY_ADDRESS);
  }
}

function startLanDiscovery() {
  if (lanDiscoverySocket) {
    broadcastLanPresence();
    return;
  }

  lanDiscoverySocket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
  lanDiscoverySocket.on('message', handleLanDiscoveryMessage);
  lanDiscoverySocket.on('error', () => null);
  lanDiscoverySocket.bind(LAN_DISCOVERY_PORT, () => {
    try {
      lanDiscoverySocket.addMembership(LAN_DISCOVERY_ADDRESS);
      lanDiscoverySocket.setMulticastTTL(1);
      lanDiscoverySocket.setBroadcast(true);
    } catch {
      // Discovery is best-effort; direct receiving still works if multicast is unavailable.
    }

    for (const address of getLanAddresses()) {
      try {
        lanDiscoverySocket.addMembership(LAN_DISCOVERY_ADDRESS, address);
      } catch {
        // Some adapters may not support multicast membership.
      }
    }

    broadcastLanPresence();
  });

  lanDiscoveryTimer = setInterval(broadcastLanPresence, LAN_DISCOVERY_INTERVAL_MS);
  lanDiscoveryPruneTimer = setInterval(pruneLanDevices, LAN_DISCOVERY_INTERVAL_MS);

  lanDiscoveryTimer?.unref?.();
  lanDiscoveryPruneTimer?.unref?.();
}

function stopLanDiscovery() {
  clearInterval(lanDiscoveryTimer);
  clearInterval(lanDiscoveryPruneTimer);
  lanDiscoveryTimer = null;
  lanDiscoveryPruneTimer = null;

  if (lanDiscoverySocket) {
    try {
      lanDiscoverySocket.close();
    } catch {
      // Socket may already be closed during app shutdown.
    }
  }

  lanDiscoverySocket = null;
  lanDevices.clear();
  lanTransferTickets.clear();
  emitLanDevicesChanged();
}

function getLanSharePublicState() {
  const addresses = getLanAddresses();
  if (!mainState.lanShareState) {
    return {
      enabled: false,
      port: 0,
      token: '',

      deviceId: getLanDeviceId(),
      urls: [],

      deviceName: getLocalDeviceName(),

      diagnostics: {
        deviceId: getLanDeviceId(),
        deviceName: getLocalDeviceName(),
        addresses,
        discoveryAddress: LAN_DISCOVERY_ADDRESS,
        discoveryPort: LAN_DISCOVERY_PORT,
        multicast: Boolean(lanDiscoverySocket)
      },

      devices: []
    };
  }

  return {
    ...mainState.lanShareState,
    urls: addresses.map((address) => `http://${address}:${mainState.lanShareState.port}/?token=${mainState.lanShareState.token}`),

    deviceName: getLocalDeviceName(),

    diagnostics: {
      deviceId: mainState.lanShareState.deviceId || getLanDeviceId(),
      deviceName: getLocalDeviceName(),
      addresses,
      discoveryAddress: LAN_DISCOVERY_ADDRESS,
      discoveryPort: LAN_DISCOVERY_PORT,
      port: mainState.lanShareState.port,
      multicast: Boolean(lanDiscoverySocket)
    },

    devices: getPublicLanDevices()
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

function getLanDeviceInfo() {
  return {
    kind: LAN_DISCOVERY_KIND,
    version: LAN_DISCOVERY_VERSION,
    id: getLanDeviceId(),
    name: getLocalDeviceName(),
    port: mainState.lanShareState?.port || 0,
    addresses: getLanAddresses(),
    sentAt: Date.now()
  };
}

function readLanHeader(request, name) {
  const value = request.headers[String(name || '').toLowerCase()];
  return Array.isArray(value) ? String(value[0] || '') : String(value || '');
}

function clampLanText(value = '', maxLength = 120) {
  return String(value || '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, maxLength);
}

function pruneLanTransferTickets() {
  const now = Date.now();

  for (const [token, ticket] of lanTransferTickets) {
    if (!ticket || now > ticket.expiresAt) {
      lanTransferTickets.delete(token);
    }
  }
}

function buildLanTransferDetail(payload = {}, remoteAddress = '') {
  const files = Array.isArray(payload.files) ? payload.files.slice(0, MAX_LAN_FILES) : [];
  const fileCount = Number(payload.fileCount || files.length || 0) || 0;
  const totalBytes = Number(payload.totalBytes || files.reduce((sum, file) => sum + (Number(file?.size || 0) || 0), 0)) || 0;
  const names = files
    .map((file) => clampLanText(file?.name || 'file', 64))
    .filter(Boolean)
    .slice(0, 5)
    .join(', ');

  return [
    `来源地址：${remoteAddress}`,
    `文件数量：${fileCount}`,
    `总大小：${Math.ceil(totalBytes / 1024)} KB`,
    names ? `文件：${names}${files.length > 5 ? ' ...' : ''}` : ''
  ].filter(Boolean).join('\n');
}

async function requestLanTransferTicket(payload = {}, request) {
  pruneLanTransferTickets();

  const remoteAddress = normalizeIpAddress(request.socket.remoteAddress || '');
  const senderId = clampLanText(
    payload.senderId || readLanHeader(request, 'x-cherrypilot-device-id'),
    80
  );
  const senderName = clampLanText(
    payload.senderName || readLanHeader(request, 'x-cherrypilot-device-name') || remoteAddress || 'LAN device',
    80
  );

  const dialogResult = await dialog.showMessageBox(mainState.mainWindow || undefined, {
    type: 'question',
    buttons: ['接收', '拒绝'],
    defaultId: 0,
    cancelId: 1,
    title: 'CherryPilot LAN Share',
    message: `接收来自 ${senderName} 的局域网文件？`,
    detail: buildLanTransferDetail(payload, remoteAddress),
    noLink: true
  });

  if (dialogResult.response !== 0) {
    throw new Error('Receiver rejected transfer');
  }

  const token = crypto.randomBytes(32).toString('hex');
  const ticket = {
    token,
    senderId,
    senderName,
    remoteAddress,
    expiresAt: Date.now() + LAN_TRANSFER_TICKET_TTL_MS
  };

  lanTransferTickets.set(token, ticket);

  return ticket;
}

function consumeLanTransferTicket(providedToken = '', request) {
  pruneLanTransferTickets();

  const remoteAddress = normalizeIpAddress(request.socket.remoteAddress || '');
  const senderId = clampLanText(readLanHeader(request, 'x-cherrypilot-device-id'), 80);

  for (const [token, ticket] of lanTransferTickets) {
    if (!safeTokenMatches(providedToken, token)) {
      continue;
    }

    if (ticket.remoteAddress && ticket.remoteAddress !== remoteAddress) {
      continue;
    }

    if (ticket.senderId && senderId && ticket.senderId !== senderId) {
      continue;
    }

    lanTransferTickets.delete(token);
    return ticket;
  }

  return null;
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
    const remoteAddress = normalizeIpAddress(request.socket.remoteAddress || '');

    if (!isPrivateLanAddress(remoteAddress)) {

      sendLanJson(response, 403, { ok: false, error: 'LAN share only accepts local-network senders' });

      return;

    }

    if (request.method === 'GET' && (url.pathname === '/device-info' || url.pathname === '/ping')) {
      sendLanJson(response, 200, { ok: true, ...getLanDeviceInfo() });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/share-request') {
      const raw = await readLanBody(request);
      const payload = JSON.parse(raw || '{}');
      const ticket = await requestLanTransferTicket(payload, request);

      sendLanJson(response, 200, {
        ok: true,
        deviceId: getLanDeviceId(),
        deviceName: getLocalDeviceName(),
        transferToken: ticket.token,
        expiresAt: new Date(ticket.expiresAt).toISOString()
      });
      return;
    }

    const headerToken = readLanHeader(request, 'x-cherrypilot-share-token');

    const providedToken = String(headerToken || url.searchParams.get('token') || '');
    const receiverTokenAllowed = safeTokenMatches(providedToken, token);
    const transferTicket = request.method === 'POST' && url.pathname === '/share' && !receiverTokenAllowed
      ? consumeLanTransferTicket(providedToken, request)
      : null;

    if (!receiverTokenAllowed && !transferTicket && !(request.method === 'GET' && url.pathname === '/')) {
      sendLanJson(response, 403, { ok: false, error: 'Invalid share token' });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/') {
      if (!receiverTokenAllowed) {
        sendLanJson(response, 403, { ok: false, error: 'Manual upload requires the receiver token' });
        return;
      }
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

async function readLanTransferFile(filePath) {
  const stat = await fs.stat(filePath);

  if (!stat.isFile()) {
    throw new Error(`${path.basename(filePath)} is not a file`);
  }

  if (stat.size > MAX_ATTACHMENT_BYTES) {
    throw new Error(`${path.basename(filePath)} is larger than 8 MB`);
  }

  const buffer = await fs.readFile(filePath);

  return {
    name: path.basename(filePath),
    type: '',
    size: buffer.length,
    data: buffer.toString('base64')
  };
}

function getLanHost(address = '') {
  return address.includes(':') ? `[${address}]` : address;
}

async function fetchLanJson(url, options = {}, timeoutMs = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  timer?.unref?.();

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    const data = await response.json().catch(() => ({}));
    return { response, data };
  } finally {
    clearTimeout(timer);
  }
}

async function resolveLanDevice(device = {}) {
  const candidates = [
    ...(Array.isArray(device.addresses) ? device.addresses : []),
    device.address
  ].map(normalizeIpAddress).filter(Boolean);
  const addresses = [...new Set([
    ...candidates.filter(isPrivateLanAddress),
    ...candidates
  ])];
  let lastError = null;

  for (const address of addresses) {
    try {
      const host = getLanHost(address);
      const { response, data } = await fetchLanJson(`http://${host}:${device.port}/device-info`, {}, 2200);

      if (
        response.ok
        && data?.kind === LAN_DISCOVERY_KIND
        && data.version === LAN_DISCOVERY_VERSION
        && String(data.id || '') === String(device.id || '')
      ) {
        return { address, info: data };
      }
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(lastError?.name === 'AbortError'
    ? 'LAN device verification timed out'
    : 'Could not verify LAN device identity');
}

function getTransferRequestPayload(payload = {}) {
  const files = Array.isArray(payload.files) ? payload.files.slice(0, MAX_LAN_FILES) : [];

  return {
    senderId: getLanDeviceId(),
    senderName: getLocalDeviceName(),
    fileCount: files.length,
    totalBytes: files.reduce((sum, file) => sum + (Number(file?.size || 0) || 0), 0),
    files: files.map((file) => ({
      name: file.name || 'file',
      type: file.type || '',
      size: Number(file.size || 0) || 0
    }))
  };
}

async function postLanTransfer(device, payload) {
  const resolved = await resolveLanDevice(device);
  const address = resolved.address || chooseDeviceAddress(device);

  if (!address) {
    throw new Error('No usable LAN address for this device');
  }

  const host = getLanHost(address);
  const body = JSON.stringify(payload);

  if (Buffer.byteLength(body, 'utf8') > MAX_LAN_BODY_BYTES) {
    throw new Error('Selected files are too large to send together');
  }

  const ticketResponse = await fetchLanJson(`http://${host}:${device.port}/share-request`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CherryPilot-Device-Id': getLanDeviceId(),
      'X-CherryPilot-Device-Name': getLocalDeviceName()
    },
    body: JSON.stringify(getTransferRequestPayload(payload))
  }, 70 * 1000);

  if (!ticketResponse.response.ok || !ticketResponse.data?.transferToken) {
    throw new Error(ticketResponse.data?.error || 'Receiver did not approve the transfer');
  }

  if (ticketResponse.data.deviceId && String(ticketResponse.data.deviceId) !== String(device.id)) {
    throw new Error('Receiver identity changed before transfer');
  }

  const response = await fetch(`http://${host}:${device.port}/share`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CherryPilot-Share-Token': ticketResponse.data.transferToken,
      'X-CherryPilot-Device-Id': getLanDeviceId(),
      'X-CherryPilot-Device-Name': getLocalDeviceName()
    },
    body
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || 'LAN send failed');
  }

  return data;
}

export async function sendLanShareToDevice(deviceId) {
  const device = lanDevices.get(String(deviceId || ''));

  if (!device || Date.now() - device.lastSeenAt > LAN_DEVICE_TTL_MS) {
    throw new Error('Device is no longer available');
  }

  const result = await dialog.showOpenDialog(mainState.mainWindow || undefined, {
    title: `Send files to ${device.name}`,
    properties: ['openFile', 'multiSelections']
  });

  if (result.canceled || result.filePaths.length === 0) {
    return {
      ok: false,
      canceled: true,
      count: 0,
      deviceName: device.name
    };
  }

  const selectedPaths = result.filePaths.slice(0, MAX_LAN_FILES);
  const files = [];

  for (const filePath of selectedPaths) {
    files.push(await readLanTransferFile(filePath));
  }

  const transfer = await postLanTransfer(device, { files });

  return {
    ok: true,
    count: transfer.count || files.length,
    deviceName: device.name
  };
}

export async function getLanShareDevices() {
  broadcastLanPresence();
  pruneLanDevices();
  return getPublicLanDevices();
}

// 启动局域网分享 HTTP 服务。
export async function startLanShare(config = {}) {
  if (mainState.lanShareServer && mainState.lanShareState) {
    startLanDiscovery();
    return getLanSharePublicState();
  }

  const token = String(config.token || crypto.randomBytes(24).toString('hex'));
  const deviceId = setLanDeviceId(config.deviceId);
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
    token,

    deviceId
  };

  startLanDiscovery();

  return getLanSharePublicState();
}

// 停止局域网分享 HTTP 服务并清空状态。
export async function stopLanShare() {
  const server = mainState.lanShareServer;
  mainState.lanShareServer = null;
  mainState.lanShareState = null;

  stopLanDiscovery();

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
    token: state.token,

    deviceId: state.deviceId
  };
  await saveSettings(settings);
  return state;
}
