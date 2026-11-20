import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

function tintPng(inputBuffer, r, g, b) {
  let offset = 8;
  let width, height, bitDepth, colorType;
  let idatChunks = [];

  while (offset < inputBuffer.length) {
    const len = inputBuffer.readUInt32BE(offset);
    const type = inputBuffer.toString('ascii', offset + 4, offset + 8);
    const data = inputBuffer.slice(offset + 8, offset + 8 + len);
    offset += 12 + len;

    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === 'IDAT') {
      idatChunks.push(data);
    }
  }

  if (bitDepth !== 8 || colorType !== 6) {
    return inputBuffer;
  }

  const decompressed = zlib.inflateSync(Buffer.concat(idatChunks));
  const bytesPerPixel = 4;
  const rowSize = 1 + width * bytesPerPixel;
  const tinted = Buffer.alloc(decompressed.length);

  for (let y = 0; y < height; y++) {
    const rowStart = y * rowSize;
    tinted[rowStart] = decompressed[rowStart]; // filter byte
    for (let x = 0; x < width; x++) {
      const p = rowStart + 1 + x * bytesPerPixel;
      const alpha = decompressed[p + 3];
      if (alpha > 0) {
        tinted[p] = r;
        tinted[p + 1] = g;
        tinted[p + 2] = b;
        tinted[p + 3] = alpha;
      } else {
        tinted[p] = 0;
        tinted[p + 1] = 0;
        tinted[p + 2] = 0;
        tinted[p + 3] = 0;
      }
    }
  }

  const recompressed = zlib.deflateSync(tinted);

  const chunks = [];
  chunks.push(inputBuffer.slice(0, 8));

  const ihdrBuf = Buffer.alloc(25);
  ihdrBuf.writeUInt32BE(13, 0);
  ihdrBuf.write('IHDR', 4);
  ihdrBuf.writeUInt32BE(width, 8);
  ihdrBuf.writeUInt32BE(height, 12);
  ihdrBuf[16] = 8;
  ihdrBuf[17] = 6;
  ihdrBuf[18] = 0;
  ihdrBuf[19] = 0;
  ihdrBuf[20] = 0;
  ihdrBuf.writeInt32BE(crc32(ihdrBuf.slice(4, 21)), 21);
  chunks.push(ihdrBuf);

  const idatHeader = Buffer.alloc(8);
  idatHeader.writeUInt32BE(recompressed.length, 0);
  idatHeader.write('IDAT', 4);
  const idatCrc = Buffer.alloc(4);
  idatCrc.writeInt32BE(crc32(Buffer.concat([Buffer.from('IDAT'), recompressed])), 0);
  chunks.push(idatHeader, recompressed, idatCrc);

  const iendBuf = Buffer.from([0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]);
  chunks.push(iendBuf);

  return Buffer.concat(chunks);
}

function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  }
  return crc ^ -1;
}

const table = new Int32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  table[i] = c;
}

// Generate tinted icons
const SKY_BLUE = [56, 189, 248]; // #38bdf8
const AMBER_GOLD = [251, 191, 36]; // #fbbf24
const WHITE = [255, 255, 255];

const iconNames = ['brand', 'model', 'cpu', 'ram', 'storage', 'screen', 'gpu'];

for (const name of iconNames) {
  const p = path.join('public/assets/promotional/icons', `${name}.png`);
  if (fs.existsSync(p)) {
    const raw = fs.readFileSync(p);
    const blueBuf = tintPng(raw, ...SKY_BLUE);
    fs.writeFileSync(path.join('public/assets/promotional/icons', `${name}_blue.png`), blueBuf);
    fs.writeFileSync(path.join('src/assets/promotional/icons', `${name}_blue.png`), blueBuf);
    console.log(`Created ${name}_blue.png`);
  }
}

// Price is amber-gold
const pricePath = 'public/assets/promotional/icons/price.png';
if (fs.existsSync(pricePath)) {
  const rawPrice = fs.readFileSync(pricePath);
  const amberBuf = tintPng(rawPrice, ...AMBER_GOLD);
  fs.writeFileSync('public/assets/promotional/icons/price_amber.png', amberBuf);
  fs.writeFileSync('src/assets/promotional/icons/price_amber.png', amberBuf);
  console.log('Created price_amber.png');
}

// Apple white for dark circular badge
const applePath = 'public/assets/promotional/icons/apple.png';
if (fs.existsSync(applePath)) {
  const rawApple = fs.readFileSync(applePath);
  const whiteBuf = tintPng(rawApple, ...WHITE);
  fs.writeFileSync('public/assets/promotional/icons/apple_white.png', whiteBuf);
  fs.writeFileSync('src/assets/promotional/icons/apple_white.png', whiteBuf);
  fs.writeFileSync('public/assets/promotional/brands/apple_white.png', whiteBuf);
  fs.writeFileSync('src/assets/promotional/brands/apple_white.png', whiteBuf);
  console.log('Created apple_white.png');
}

console.log('Tinting complete!');
