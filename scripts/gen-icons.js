// Generates the PWA PNG icons (public/icon-192.png, icon-512.png, apple-touch-icon.png)
// using only Node built-ins (zlib). Run with: node scripts/gen-icons.js
const zlib = require("node:zlib");
const fs = require("node:fs");
const path = require("node:path");

let table = null;
function crc32(buf) {
  if (!table) {
    table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}
function encodePNG(width, height, px) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter none
    px.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, y * width * 4 + width * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

const GREEN = [22, 61, 54]; // #163d36
const WHITE = [255, 255, 255];
const SAGE = [220, 235, 229]; // #dcebe5
const ACCENT = [119, 173, 158]; // #77ad9e

function makeIcon(size) {
  const px = Buffer.alloc(size * size * 4);
  const set = (x, y, [r, g, b]) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255;
  };
  const fillRect = (x0, y0, x1, y1, color) => {
    for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(size - 1, Math.floor(y1)); y++)
      for (let x = Math.max(0, Math.floor(x0)); x <= Math.min(size - 1, Math.floor(x1)); x++) set(x, y, color);
  };
  const fillRounded = (x0, y0, x1, y1, r, color) => {
    for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(size - 1, Math.floor(y1)); y++) {
      for (let x = Math.max(0, Math.floor(x0)); x <= Math.min(size - 1, Math.floor(x1)); x++) {
        const insideBody = (x >= x0 + r && x <= x1 - r) || (y >= y0 + r && y <= y1 - r);
        if (insideBody) { set(x, y, color); continue; }
        let inCorner = false;
        if (x < x0 + r && y < y0 + r) inCorner = (x - (x0 + r)) ** 2 + (y - (y0 + r)) ** 2 <= r * r;
        else if (x > x1 - r && y < y0 + r) inCorner = (x - (x1 - r)) ** 2 + (y - (y0 + r)) ** 2 <= r * r;
        else if (x < x0 + r && y > y1 - r) inCorner = (x - (x0 + r)) ** 2 + (y - (y1 - r)) ** 2 <= r * r;
        else if (x > x1 - r && y > y1 - r) inCorner = (x - (x1 - r)) ** 2 + (y - (y1 - r)) ** 2 <= r * r;
        if (inCorner) set(x, y, color);
      }
    }
  };

  // Brand background
  fillRect(0, 0, size - 1, size - 1, GREEN);
  const inset = size * 0.115;
  const cardX0 = inset, cardX1 = size - inset, cardY0 = inset, cardY1 = size - inset;
  const radius = size * 0.07;
  // White calendar card
  fillRounded(cardX0, cardY0, cardX1, cardY1, radius, WHITE);
  // Top header band
  fillRounded(cardX0 + size * 0.05, cardY0 + size * 0.075, cardX1 - size * 0.05, cardY0 + size * 0.24, size * 0.035, ACCENT);
  // Two schedule rows
  const rowH = size * 0.10, rowGap = size * 0.06, rowLeft = cardX0 + size * 0.075, rowRight = cardX1 - size * 0.075;
  let y = cardY0 + size * 0.34;
  for (let i = 0; i < 2; i++) {
    fillRounded(rowLeft, y, rowRight, y + rowH, size * 0.025, SAGE);
    y += rowH + rowGap;
  }
  return px;
}

const publicDir = path.join(__dirname, "..", "public");
for (const [name, size] of [["icon-192.png", 192], ["icon-512.png", 512], ["apple-touch-icon.png", 180]]) {
  const px = makeIcon(size);
  fs.writeFileSync(path.join(publicDir, name), encodePNG(size, size, px));
  console.log(`Wrote public/${name} (${size}x${size})`);
}