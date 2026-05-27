const fs = require('fs');

const path = require('path');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..');
const ASSETS_DIR = path.join(ROOT, 'src', 'assets');
const GRID = 48;

const palette = {
  bg: '#111820',
  bg2: '#1b2630',
  bg3: '#273542',
  cherry: '#ff4d7a',
  cherryMid: '#d63f63',
  cherryDeep: '#8f203d',
  shine: '#ffe2e8',
  leaf: '#38d787',
  leafMid: '#1fa36f',
  leafDeep: '#14796f',
  stem: '#66d38f',
  shadow: '#05070b'
};

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let c = n;
  for (let k = 0; k < 8; k += 1) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c >>> 0;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  const crc = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function parseHex(hex) {
  const normalized = hex.replace('#', '');
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16)
  ];
}

function makeImage(size) {
  return Buffer.alloc(size * size * 4);
}

function fillRect(image, size, rect, color, alpha = 255) {
  const [r, g, b] = parseHex(color);
  const x0 = Math.max(0, Math.round((rect.x / GRID) * size));
  const y0 = Math.max(0, Math.round((rect.y / GRID) * size));
  const x1 = Math.min(size, Math.round(((rect.x + rect.w) / GRID) * size));
  const y1 = Math.min(size, Math.round(((rect.y + rect.h) / GRID) * size));

  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const offset = (y * size + x) * 4;
      image[offset] = r;
      image[offset + 1] = g;
      image[offset + 2] = b;
      image[offset + 3] = alpha;
    }
  }
}

function drawPixelShell(image, size) {
  [
    { x: 10, y: 4, w: 28, h: 40, c: palette.bg },
    { x: 7, y: 8, w: 34, h: 32, c: palette.bg },
    { x: 5, y: 12, w: 38, h: 24, c: palette.bg },
    { x: 11, y: 7, w: 26, h: 34, c: palette.bg2 },
    { x: 8, y: 11, w: 32, h: 26, c: palette.bg2 },
    { x: 12, y: 9, w: 24, h: 3, c: palette.bg3 },
    { x: 8, y: 14, w: 3, h: 19, c: palette.bg3 }
  ].forEach((rect) => fillRect(image, size, rect, rect.c));
}

function drawPixelCherry(image, size) {
  [
    { x: 28, y: 6, w: 4, h: 6, c: palette.stem },
    { x: 24, y: 12, w: 4, h: 6, c: palette.stem },
    { x: 14, y: 10, w: 14, h: 6, c: palette.leafDeep },
    { x: 10, y: 16, w: 14, h: 6, c: palette.leafMid },
    { x: 14, y: 22, w: 8, h: 4, c: palette.leaf },
    { x: 18, y: 20, w: 14, h: 22, c: palette.cherryDeep },
    { x: 14, y: 24, w: 22, h: 16, c: palette.cherryDeep },
    { x: 12, y: 30, w: 26, h: 8, c: palette.cherryDeep },
    { x: 16, y: 26, w: 18, h: 14, c: palette.cherryMid },
    { x: 14, y: 30, w: 22, h: 6, c: palette.cherryMid },
    { x: 20, y: 26, w: 10, h: 12, c: palette.cherry },
    { x: 18, y: 30, w: 14, h: 6, c: palette.cherry },
    { x: 18, y: 28, w: 6, h: 6, c: palette.shine },
    { x: 20, y: 40, w: 12, h: 4, c: palette.cherryDeep }
  ].forEach((rect) => fillRect(image, size, rect, rect.c));
}

function encodePng(image, size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);

  for (let y = 0; y < size; y += 1) {
    const rawOffset = y * (size * 4 + 1);
    const imageOffset = y * size * 4;
    raw[rawOffset] = 0;
    image.copy(raw, rawOffset + 1, imageOffset, imageOffset + size * 4);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

function createIconPng(size) {
  const image = makeImage(size);
  drawPixelShell(image, size);
  drawPixelCherry(image, size);
  return encodePng(image, size);
}

function createIco(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);

  const entries = [];
  let offset = header.length + pngs.length * 16;

  for (const { size, png } of pngs) {
    const entry = Buffer.alloc(16);
    entry[0] = size >= 256 ? 0 : size;
    entry[1] = size >= 256 ? 0 : size;
    entry[2] = 0;
    entry[3] = 0;
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += png.length;
  }

  return Buffer.concat([header, ...entries, ...pngs.map((item) => item.png)]);
}

function writeSvg() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" shape-rendering="crispEdges">
  <rect x="10" y="4" width="28" height="40" fill="${palette.bg}"/>
  <rect x="7" y="8" width="34" height="32" fill="${palette.bg}"/>
  <rect x="5" y="12" width="38" height="24" fill="${palette.bg}"/>
  <rect x="11" y="7" width="26" height="34" fill="${palette.bg2}"/>
  <rect x="8" y="11" width="32" height="26" fill="${palette.bg2}"/>
  <rect x="12" y="9" width="24" height="3" fill="${palette.bg3}"/>
  <rect x="8" y="14" width="3" height="19" fill="${palette.bg3}"/>
  <rect x="28" y="6" width="4" height="6" fill="${palette.stem}"/>
  <rect x="24" y="12" width="4" height="6" fill="${palette.stem}"/>
  <rect x="14" y="10" width="14" height="6" fill="${palette.leafDeep}"/>
  <rect x="10" y="16" width="14" height="6" fill="${palette.leafMid}"/>
  <rect x="14" y="22" width="8" height="4" fill="${palette.leaf}"/>
  <rect x="18" y="20" width="14" height="22" fill="${palette.cherryDeep}"/>
  <rect x="14" y="24" width="22" height="16" fill="${palette.cherryDeep}"/>
  <rect x="12" y="30" width="26" height="8" fill="${palette.cherryDeep}"/>
  <rect x="16" y="26" width="18" height="14" fill="${palette.cherryMid}"/>
  <rect x="14" y="30" width="22" height="6" fill="${palette.cherryMid}"/>
  <rect x="20" y="26" width="10" height="12" fill="${palette.cherry}"/>
  <rect x="18" y="30" width="14" height="6" fill="${palette.cherry}"/>
  <rect x="18" y="28" width="6" height="6" fill="${palette.shine}"/>
  <rect x="20" y="40" width="12" height="4" fill="${palette.cherryDeep}"/>
</svg>
`;
  fs.writeFileSync(path.join(ASSETS_DIR, 'cherrypilot.svg'), svg);
}

fs.mkdirSync(ASSETS_DIR, { recursive: true });

const sizes = [16, 24, 32, 48, 64, 128, 256];
const pngs = sizes.map((size) => ({ size, png: createIconPng(size) }));

fs.writeFileSync(path.join(ASSETS_DIR, 'cherrypilot.png'), pngs[pngs.length - 1].png);
fs.writeFileSync(path.join(ASSETS_DIR, 'cherrypilot.ico'), createIco(pngs));
writeSvg();

console.log(`Generated ${path.relative(ROOT, ASSETS_DIR)}\\cherrypilot.{png,ico,svg}`);
