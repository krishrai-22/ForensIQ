/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * WebCrypto helpers for ECDSA P-256, SHA-256, and tamper-evident records.
 */

// Convert ArrayBuffer to Hex string
export function bufferToHex(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

// Convert Hex string to Uint8Array
export function hexToBuffer(hex: string): Uint8Array {
  const cleanHex = hex.replace(/[^0-9a-fA-F]/g, '');
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16);
  }
  return bytes;
}

// Convert ArrayBuffer to Base64
export function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Convert Base64 to Uint8Array
export function base64ToBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Compute SHA-256 hash of an ArrayBuffer, Uint8Array, or UTF-8 string.
 * Returns lowercase hex string.
 */
export async function sha256Hex(data: ArrayBuffer | Uint8Array | string): Promise<string> {
  let buffer: ArrayBuffer;
  if (typeof data === 'string') {
    buffer = new TextEncoder().encode(data).buffer;
  } else if (data instanceof Uint8Array) {
    buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
  } else {
    buffer = data;
  }
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return bufferToHex(hashBuffer);
}

/**
 * Format a 64-char hex string as a colon-delimited fingerprint
 * e.g. "8A:9F:44:1B:..."
 */
export function formatFingerprint(hex: string): string {
  const cleaned = hex.replace(/[^0-9a-fA-F]/g, '').toUpperCase();
  const pairs: string[] = [];
  for (let i = 0; i < cleaned.length; i += 2) {
    pairs.push(cleaned.substring(i, i + 2));
  }
  return pairs.join(':');
}

/**
 * Generate an ECDSA P-256 keypair.
 * The private key is strictly NON-EXTRACTABLE (extractable = false) as mandated.
 * WebCrypto supports storing non-extractable keys in IndexedDB.
 */
export async function generateOperatorKeyPair(): Promise<CryptoKeyPair> {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'ECDSA',
      namedCurve: 'P-256',
    },
    false, // extractable: false for private key
    ['sign', 'verify']
  );
  return keyPair;
}

/**
 * Export public key to SubjectPublicKeyInfo (SPKI) DER ArrayBuffer.
 */
export async function exportPublicKeySpki(publicKey: CryptoKey): Promise<ArrayBuffer> {
  return await crypto.subtle.exportKey('spki', publicKey);
}

/**
 * Export public key to JWK (JSON Web Key).
 */
export async function exportPublicKeyJwk(publicKey: CryptoKey): Promise<JsonWebKey> {
  return await crypto.subtle.exportKey('jwk', publicKey);
}

/**
 * Import public key from SPKI (ArrayBuffer or Uint8Array).
 */
export async function importPublicKeySpki(spkiBuffer: ArrayBuffer | Uint8Array): Promise<CryptoKey> {
  const buffer: ArrayBuffer =
    spkiBuffer instanceof Uint8Array
      ? (spkiBuffer.buffer.slice(spkiBuffer.byteOffset, spkiBuffer.byteOffset + spkiBuffer.byteLength) as ArrayBuffer)
      : spkiBuffer;

  return await crypto.subtle.importKey(
    'spki',
    buffer as BufferSource,
    {
      name: 'ECDSA',
      namedCurve: 'P-256',
    },
    true,
    ['verify']
  );
}

/**
 * Calculate the fingerprint of a public key.
 * Standard method: SHA-256 of the exported SPKI DER bytes.
 */
export async function calculatePublicKeyFingerprint(publicKey: CryptoKey): Promise<{
  fingerprint: string;
  fingerprintHex: string;
  spkiBase64: string;
}> {
  const spki = await exportPublicKeySpki(publicKey);
  const hashHex = await sha256Hex(spki);
  return {
    fingerprint: formatFingerprint(hashHex),
    fingerprintHex: hashHex,
    spkiBase64: bufferToBase64(spki),
  };
}

/**
 * Deterministic JSON Canonicalization (RFC 8785 style sorted keys).
 * Produces reproducible string representations for cryptographic hashing and signing.
 */
export function canonicalizeJson(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }

  if (Array.isArray(obj)) {
    const elements = obj.map((item) => canonicalizeJson(item));
    return `[${elements.join(',')}]`;
  }

  const record = obj as Record<string, unknown>;
  const sortedKeys = Object.keys(record).sort();
  const properties: string[] = [];

  for (const key of sortedKeys) {
    const value = record[key];
    if (value !== undefined && typeof value !== 'function' && typeof value !== 'symbol') {
      properties.push(`${JSON.stringify(key)}:${canonicalizeJson(value)}`);
    }
  }

  return `{${properties.join(',')}}`;
}

/**
 * Sign data with an ECDSA P-256 private key using SHA-256.
 * Returns the raw DER or IEEE P1363 signature in hex format.
 */
export async function signDataWithEcdsa(
  privateKey: CryptoKey,
  data: ArrayBuffer | Uint8Array | string
): Promise<string> {
  let buffer: ArrayBuffer;
  if (typeof data === 'string') {
    buffer = new TextEncoder().encode(data).buffer;
  } else if (data instanceof Uint8Array) {
    buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
  } else {
    buffer = data;
  }

  const signature = await crypto.subtle.sign(
    {
      name: 'ECDSA',
      hash: { name: 'SHA-256' },
    },
    privateKey,
    buffer
  );

  return bufferToHex(signature);
}

/**
 * Verify an ECDSA P-256 signature against data with a public key.
 */
export async function verifyDataWithEcdsa(
  publicKey: CryptoKey,
  signatureHex: string,
  data: ArrayBuffer | Uint8Array | string
): Promise<boolean> {
  try {
    let buffer: ArrayBuffer;
    if (typeof data === 'string') {
      buffer = new TextEncoder().encode(data).buffer;
    } else if (data instanceof Uint8Array) {
      buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
    } else {
      buffer = data;
    }

    const signatureBytes = hexToBuffer(signatureHex);
    const signatureBuffer: ArrayBuffer = signatureBytes.buffer.slice(
      signatureBytes.byteOffset,
      signatureBytes.byteOffset + signatureBytes.byteLength
    ) as ArrayBuffer;

    return await crypto.subtle.verify(
      {
        name: 'ECDSA',
        hash: { name: 'SHA-256' },
      },
      publicKey,
      signatureBuffer as BufferSource,
      buffer as BufferSource
    );
  } catch (err) {
    console.warn('Verification failed with error:', err);
    return false;
  }
}
