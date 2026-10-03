const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Minimal PNG generator without native dependencies
function createPng(width, height, drawFn) {
  const crcTable = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crcTable[n] = c;
  }

  function crc32(buf) {
    let crc = -1;
    for (let i = 0; i < buf.length; i++) {
      crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xff];
    }
    return (crc ^ -1) >>> 0;
  }

  function makeChunk(type, data) {
    const len = data.length;
    const buf = Buffer.alloc(8 + len + 4);
    buf.writeUInt32BE(len, 0);
    buf.write(type, 4, 4, 'ascii');
    data.copy(buf, 8);
    const typeAndData = buf.subarray(4, 8 + len);
    const crc = crc32(typeAndData);
    buf.writeUInt32BE(crc, 8 + len);
    return buf;
  }

  // Header chunk (IHDR)
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8-bit depth
  ihdr[9] = 6; // Color type RGBA
  ihdr[10] = 0; // Compression
  ihdr[11] = 0; // Filter
  ihdr[12] = 0; // Interlace

  // Raw bitmap buffer with filter byte 0 at start of each scanline
  const rowBytes = 1 + width * 4;
  const rawData = Buffer.alloc(height * rowBytes);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowBytes;
    rawData[rowOffset] = 0; // Filter type 0 (None)
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = drawFn(x, y, width, height);
      const pxOffset = rowOffset + 1 + x * 4;
      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  }

  const compressed = zlib.deflateSync(rawData);
  const idat = makeChunk('IDAT', compressed);
  const ihdrChunk = makeChunk('IHDR', ihdr);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([signature, ihdrChunk, idat, iendChunk]);
}

function fieldTestIconPainter(isMaskable) {
  return function (x, y, w, h) {
    const nx = x / w;
    const ny = y / h;
    const dx = nx - 0.5;
    const dy = ny - 0.5;

    // Deep blue background #0a192f to #071324
    let r = Math.round(10 + ny * 12);
    let g = Math.round(25 + ny * 14);
    let b = Math.round(47 + ny * 18);
    let a = 255;

    // Outer border radius if not maskable
    if (!isMaskable) {
      const cornerR = 0.22;
      const qx = Math.max(0, Math.abs(dx) - (0.5 - cornerR));
      const qy = Math.max(0, Math.abs(dy) - (0.5 - cornerR));
      if (Math.hypot(qx, qy) > cornerR) {
        return [0, 0, 0, 0];
      }
    }

    // Magnifying glass center & handle
    const cx = 0.44;
    const cy = 0.44;
    const lensRadius = 0.26;
    const rimWidth = 0.045;

    // Handle from (0.62, 0.62) to (0.86, 0.86)
    // Distance from handle line: y = x (for x between 0.60 and 0.85)
    if (nx >= 0.58 && nx <= 0.86 && ny >= 0.58 && ny <= 0.86) {
      const distToDiag = Math.abs(ny - nx) / Math.SQRT2;
      if (distToDiag < 0.045) {
        // Handle metallic/cyan gradient
        return [56, 189, 248, 255]; // #38bdf8
      }
    }

    const distFromLensCenter = Math.hypot(nx - cx, ny - cy);

    // Lens rim
    if (distFromLensCenter <= lensRadius + rimWidth && distFromLensCenter >= lensRadius) {
      return [37, 99, 235, 255]; // Royal blue #2563eb
    }

    // Inside the search lens
    if (distFromLensCenter < lensRadius) {
      // Medicine capsule centered at (cx, cy), rotated 45 degrees
      // Coordinate transform to pill coordinates (u, v)
      const cos45 = Math.SQRT1_2;
      const sin45 = Math.SQRT1_2;
      const relX = nx - cx;
      const relY = ny - cy;

      const u = relX * cos45 + relY * sin45;
      const v = -relX * sin45 + relY * cos45;

      const pillHalfW = 0.065;
      const pillHalfH = 0.14;
      const pillRadius = 0.065;

      // Check capsule distance
      const clampedV = Math.max(-pillHalfH + pillRadius, Math.min(pillHalfH - pillRadius, v));
      const distToCapsuleCore = Math.hypot(u, v - clampedV);

      if (distToCapsuleCore <= pillRadius) {
        // Divider line
        if (Math.abs(v) < 0.007) {
          return [15, 23, 42, 255]; // dark seam
        }

        // Top half (v < 0) -> Medical cyan/blue
        if (v < 0) {
          return [56, 189, 248, 255]; // #38bdf8
        } else {
          // Bottom half (v > 0) -> Crisp white with medical cross
          // Cross in bottom half
          if (Math.abs(u) < 0.015 && v > 0.03 && v < 0.09) {
            return [2, 132, 199, 255]; // blue cross vertical
          }
          if (Math.abs(v - 0.06) < 0.015 && Math.abs(u) < 0.035) {
            return [2, 132, 199, 255]; // blue cross horizontal
          }
          return [255, 255, 255, 255]; // white pill body
        }
      }

      // Lens glass background
      return [15, 30, 60, 255];
    }

    return [r, g, b, a];
  };
}

const publicDir = path.resolve(__dirname, '../public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), createPng(192, 192, fieldTestIconPainter(false)));
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), createPng(512, 512, fieldTestIconPainter(false)));
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), createPng(512, 512, fieldTestIconPainter(true)));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), createPng(180, 180, fieldTestIconPainter(false)));
fs.writeFileSync(path.join(publicDir, 'favicon.ico'), createPng(48, 48, fieldTestIconPainter(false)));

console.log('Successfully generated all PWA icons in /public');
