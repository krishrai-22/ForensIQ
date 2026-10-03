/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Lightweight, zero-dependency pure TypeScript ZIP creator for forensic evidence bundles.
 * Uses ZIP specification Method 0 (Store) for maximum compatibility and zero compression corruption.
 */

interface ZipEntry {
  filename: string;
  data: Uint8Array;
}

function createCrc32Table(): Uint32Array {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c;
  }
  return table;
}

const CRC32_TABLE = createCrc32Table();

function calculateCrc32(data: Uint8Array): number {
  let crc = -1;
  for (let i = 0; i < data.length; i++) {
    crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ data[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

export function createZipArchive(entries: ZipEntry[]): Blob {
  const parts: Uint8Array[] = [];
  const centralDirEntries: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const filenameBytes = new TextEncoder().encode(entry.filename);
    const crc = calculateCrc32(entry.data);
    const size = entry.data.length;

    // Local file header (30 bytes + filename)
    const localHeader = new Uint8Array(30 + filenameBytes.length);
    const lv = new DataView(localHeader.buffer);

    lv.setUint32(0, 0x04034b50, true); // Local file header signature
    lv.setUint16(4, 20, true); // Version needed to extract (2.0)
    lv.setUint16(6, 0, true); // General purpose bit flag
    lv.setUint16(8, 0, true); // Compression method (0 = store)
    lv.setUint16(10, 0, true); // File last mod time
    lv.setUint16(12, 0, true); // File last mod date
    lv.setUint32(14, crc, true); // CRC-32
    lv.setUint32(18, size, true); // Compressed size
    lv.setUint32(22, size, true); // Uncompressed size
    lv.setUint16(26, filenameBytes.length, true); // Filename length
    lv.setUint16(28, 0, true); // Extra field length
    localHeader.set(filenameBytes, 30);

    parts.push(localHeader);
    parts.push(entry.data);

    // Central directory header (46 bytes + filename)
    const cdHeader = new Uint8Array(46 + filenameBytes.length);
    const cdv = new DataView(cdHeader.buffer);

    cdv.setUint32(0, 0x02014b50, true); // Central directory signature
    cdv.setUint16(4, 20, true); // Version made by
    cdv.setUint16(6, 20, true); // Version needed to extract
    cdv.setUint16(8, 0, true); // General purpose bit flag
    cdv.setUint16(10, 0, true); // Compression method (0 = store)
    cdv.setUint16(12, 0, true); // Last mod time
    cdv.setUint16(14, 0, true); // Last mod date
    cdv.setUint32(16, crc, true); // CRC-32
    cdv.setUint32(20, size, true); // Compressed size
    cdv.setUint32(24, size, true); // Uncompressed size
    cdv.setUint16(28, filenameBytes.length, true); // Filename length
    cdv.setUint16(30, 0, true); // Extra field length
    cdv.setUint16(32, 0, true); // File comment length
    cdv.setUint16(34, 0, true); // Disk number start
    cdv.setUint16(36, 0, true); // Internal file attributes
    cdv.setUint32(38, 0, true); // External file attributes
    cdv.setUint32(42, offset, true); // Relative offset of local header
    cdHeader.set(filenameBytes, 46);

    centralDirEntries.push(cdHeader);
    offset += localHeader.length + entry.data.length;
  }

  const centralDirOffset = offset;
  let centralDirSize = 0;
  for (const cd of centralDirEntries) {
    parts.push(cd);
    centralDirSize += cd.length;
  }

  // End of central directory record (22 bytes)
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true); // EOCD signature
  ev.setUint16(4, 0, true); // Number of this disk
  ev.setUint16(6, 0, true); // Disk where central directory starts
  ev.setUint16(8, entries.length, true); // Number of central directory records on this disk
  ev.setUint16(10, entries.length, true); // Total number of central directory records
  ev.setUint32(12, centralDirSize, true); // Size of central directory
  ev.setUint32(16, centralDirOffset, true); // Offset of start of central directory
  ev.setUint16(20, 0, true); // Comment length

  parts.push(eocd);

  return new Blob(parts as unknown as BlobPart[], { type: 'application/zip' });
}
