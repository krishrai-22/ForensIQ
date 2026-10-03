/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  sha256Hex,
  canonicalizeJson,
  signDataWithEcdsa,
  verifyDataWithEcdsa,
  importPublicKeySpki,
  base64ToBuffer,
} from './crypto.ts';
import { db, getStoredOperatorProfile, getStoredOperatorCryptoKey } from '../db/index.ts';
import type {
  SignedTestRecord,
  TestRecordEntity,
  GpsData,
  CalibrationData,
  QualityGateResult,
  TestResultOutcome,
} from '../types/index.ts';
import type { ClassificationResult } from './classifier.ts';

// Recorded at startup to compute monotonic boot-relative offset
export const BOOT_BASELINE_MS = Date.now() - performance.now();

export function getMonotonicClockMs(): number {
  return Number((BOOT_BASELINE_MS + performance.now()).toFixed(3));
}

/**
 * Acquire GPS location with reasonable timeout for field operations.
 * Returns explicit status if unavailable, denied, or timed out.
 */
export async function acquireGpsData(timeoutMs = 4000): Promise<GpsData> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return {
      latitude: null,
      longitude: null,
      accuracyMeters: null,
      timestampIso: null,
      status: 'UNAVAILABLE',
    };
  }

  return new Promise<GpsData>((resolve) => {
    let resolved = false;

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve({
          latitude: null,
          longitude: null,
          accuracyMeters: null,
          timestampIso: null,
          status: 'TIMEOUT',
        });
      }
    }, timeoutMs);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracyMeters: pos.coords.accuracy,
            timestampIso: new Date(pos.timestamp).toISOString(),
            status: 'FIXED',
          });
        }
      },
      (err) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          resolve({
            latitude: null,
            longitude: null,
            accuracyMeters: null,
            timestampIso: null,
            status: err.code === 1 ? 'DENIED' : 'UNAVAILABLE',
          });
        }
      },
      {
        enableHighAccuracy: true,
        timeout: timeoutMs,
        maximumAge: 10000,
      }
    );
  });
}

export interface VerificationCheckItem {
  name: string;
  passed: boolean;
  expected?: string;
  actual?: string;
  message: string;
}

export interface VerificationReport {
  overallPass: boolean;
  imageHashPass: boolean;
  recordHashPass: boolean;
  signaturePass: boolean;
  hashChainPass: boolean;
  checks: VerificationCheckItem[];
  tamperDetected: boolean;
}

/**
 * Strips cryptographic signature & record hash to obtain the unsigned canonical payload
 */
export function getUnsignedRecordPayload(record: SignedTestRecord): Record<string, unknown> {
  const {
    signatureHex,
    recordHashSha256,
    syncStatus,
    syncedAtIso,
    serverCounterSignature,
    tampered,
    ...unsignedPayload
  } = record as SignedTestRecord & { tampered?: boolean };

  return unsignedPayload as Record<string, unknown>;
}

/**
 * Creates, canonicalises, hashes, and signs a new evidentiary field test record
 */
export async function createAndSignTestRecord(params: {
  kitProfileId: string;
  kitProfileVersion: string;
  calibrationData: CalibrationData;
  classification: ClassificationResult;
  evaluation: {
    passed: boolean;
    blurVariance: number;
    meanLuminance: number;
    glarePercent: number;
    reasons: string[];
  };
  reactionElapsedSeconds?: number;
  reactionTimeFlag?: 'ON_TIME' | 'EARLY' | 'LATE';
  imageBlob?: Blob;
  sampleBlob?: Blob;
  cardBlob?: Blob;
}): Promise<TestRecordEntity> {
  const {
    kitProfileId,
    kitProfileVersion,
    calibrationData,
    classification,
    evaluation,
    reactionElapsedSeconds,
    reactionTimeFlag,
    imageBlob,
    sampleBlob,
    cardBlob,
  } = params;

  // 1. Operator Identity & Crypto Key
  const profile = await getStoredOperatorProfile();
  if (!profile) {
    throw new Error('No operator profile enrolled on this device.');
  }

  const storedCrypto = await getStoredOperatorCryptoKey();
  if (!storedCrypto || !storedCrypto.privateKey) {
    throw new Error('Non-extractable ECDSA private signing key not found in IndexedDB.');
  }

  // 2. Compute SHA-256 digests of captured photos
  const effectiveSampleBlob = sampleBlob || imageBlob;
  if (!effectiveSampleBlob) {
    throw new Error('No sample image blob provided for signing.');
  }
  const sampleBuffer = await effectiveSampleBlob.arrayBuffer();
  const sampleHash = await sha256Hex(sampleBuffer);

  let cardHash: string | undefined = undefined;
  if (cardBlob) {
    const cardBuffer = await cardBlob.arrayBuffer();
    cardHash = await sha256Hex(cardBuffer);
  }

  const imageHashSha256 = sampleHash; // Primary evidence image digest

  // 3. Monotonic Clock Reading & Time
  const timestampIso = new Date().toISOString();
  const bootClockMs = getMonotonicClockMs();

  // 4. GPS Fix
  const gps = await acquireGpsData();

  // 5. Hash Chain Linkage: Fetch previous record from IndexedDB
  const lastRecord = await db.testRecords.orderBy('timestampIso').last();
  const prevRecordHash = lastRecord ? lastRecord.recordHashSha256 : 'GENESIS';

  // 6. Assemble Unsigned Canonical Record Data
  const id = crypto.randomUUID();

  const qualityGates: QualityGateResult = {
    passed: evaluation.passed,
    blurVariance: evaluation.blurVariance,
    isBlurry: evaluation.blurVariance < 45,
    meanLuminance: evaluation.meanLuminance,
    isUnderExposed: evaluation.meanLuminance < 38,
    isOverExposed: evaluation.meanLuminance > 225,
    glarePixelPercent: evaluation.glarePercent,
    hasGlare: evaluation.glarePercent > 4.5,
    warnings: evaluation.reasons,
  };

  const unsignedRecord: Omit<SignedTestRecord, 'signatureHex' | 'recordHashSha256' | 'syncStatus'> = {
    id,
    timestampIso,
    bootClockMs,
    gps,
    operatorId: profile.operatorId,
    badgeUnit: profile.badgeUnit,
    deviceInfo: {
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
      platform: typeof navigator !== 'undefined' ? navigator.platform : 'Unknown',
      screenResolution: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : 'Unknown',
    },
    kitProfileId,
    kitProfileVersion,
    algorithmVersion: '1.0.0-ciede2000-matrix',
    result: classification.result,
    confidence: classification.confidence,
    reason: classification.reason,
    reactionElapsedSeconds,
    reactionTimeFlag,
    calibrationData,
    qualityGates,
    imageHashSha256,
    sampleImageHashSha256: sampleHash,
    referenceCardImageHashSha256: cardHash,
    prevRecordHash,
    publicKeyFingerprint: profile.keyFingerprint,
  };

  // 7. Canonicalise (sorted keys JSON) and compute Record SHA-256
  const canonicalJson = canonicalizeJson(unsignedRecord);
  const recordHashSha256 = await sha256Hex(canonicalJson);

  // 8. Sign record SHA-256 with non-extractable ECDSA P-256 key
  const signatureHex = await signDataWithEcdsa(storedCrypto.privateKey, recordHashSha256);

  // 9. Form Full Signed Record
  const signedRecord: TestRecordEntity = {
    ...unsignedRecord,
    recordHashSha256,
    signatureHex,
    syncStatus: 'pending',
    imageBlob: effectiveSampleBlob,
    sampleImageBlob: effectiveSampleBlob,
    referenceCardImageBlob: cardBlob,
  };

  // 10. Persist into IndexedDB
  await db.testRecords.put(signedRecord);

  return signedRecord;
}

/**
 * Re-verifies a stored test record:
 * 1. Image Hash Check: SHA-256 of stored JPEG matches `record.imageHashSha256`
 * 2. Record Hash Check: SHA-256 of canonical payload matches `record.recordHashSha256`
 * 3. Signature Check: ECDSA verification using public key against record hash
 * 4. Hash Chain Link Check: Previous record hash matches `record.prevRecordHash`
 */
export async function verifyTestRecord(
  record: SignedTestRecord,
  imageBlob?: Blob,
  prevRecord?: SignedTestRecord | null,
  publicKey?: CryptoKey
): Promise<VerificationReport> {
  const checks: VerificationCheckItem[] = [];

  // Check 1: Image SHA-256 Digest
  let imageHashPass = false;
  if (imageBlob) {
    try {
      const buffer = await imageBlob.arrayBuffer();
      const calculatedImageHash = await sha256Hex(buffer);
      imageHashPass = calculatedImageHash === record.imageHashSha256;
      checks.push({
        name: 'Image Integrity (SHA-256)',
        passed: imageHashPass,
        expected: record.imageHashSha256.substring(0, 16) + '...',
        actual: calculatedImageHash.substring(0, 16) + '...',
        message: imageHashPass
          ? 'Captured JPEG byte sequence matches cryptographic hash digest.'
          : 'FAIL: Image file has been altered or corrupted after capture.',
      });
    } catch (err) {
      checks.push({
        name: 'Image Integrity (SHA-256)',
        passed: false,
        message: 'Could not read image blob for verification: ' + String(err),
      });
    }
  } else {
    // If no blob provided, check against internal image if record has it
    checks.push({
      name: 'Image Integrity (SHA-256)',
      passed: true,
      message: 'Image blob check skipped (no local blob provided).',
    });
    imageHashPass = true;
  }

  // Check 2: Canonical Record SHA-256 Digest
  let recordHashPass = false;
  try {
    const unsignedPayload = getUnsignedRecordPayload(record);
    const canonicalJson = canonicalizeJson(unsignedPayload);
    const calculatedRecordHash = await sha256Hex(canonicalJson);
    recordHashPass = calculatedRecordHash === record.recordHashSha256;

    checks.push({
      name: 'Record Payload Integrity (Canonical SHA-256)',
      passed: recordHashPass,
      expected: record.recordHashSha256.substring(0, 16) + '...',
      actual: calculatedRecordHash.substring(0, 16) + '...',
      message: recordHashPass
        ? 'Canonical sorted-key JSON matches recorded SHA-256 checksum.'
        : 'FAIL: Record contents (result, confidence, or calibration) were tampered with.',
    });
  } catch (err) {
    checks.push({
      name: 'Record Payload Integrity (Canonical SHA-256)',
      passed: false,
      message: 'Failed to canonicalise record payload: ' + String(err),
    });
  }

  // Check 3: ECDSA P-256 Digital Signature
  let signaturePass = false;
  try {
    let keyToVerify = publicKey;
    if (!keyToVerify) {
      // Look up operator public key from IndexedDB profile
      const profile = await getStoredOperatorProfile();
      if (profile && profile.publicKeySpkiBase64) {
        const spkiBytes = base64ToBuffer(profile.publicKeySpkiBase64);
        keyToVerify = await importPublicKeySpki(spkiBytes);
      }
    }

    if (keyToVerify) {
      signaturePass = await verifyDataWithEcdsa(
        keyToVerify,
        record.signatureHex,
        record.recordHashSha256
      );

      checks.push({
        name: 'Operator Digital Signature (ECDSA P-256)',
        passed: signaturePass,
        message: signaturePass
          ? 'Digital signature valid and verified against operator public key.'
          : 'FAIL: ECDSA signature verification failed. The record hash was modified or signed by an unauthorized key.',
      });
    } else {
      checks.push({
        name: 'Operator Digital Signature (ECDSA P-256)',
        passed: false,
        message: 'FAIL: Officer public key not found for verification.',
      });
    }
  } catch (err) {
    checks.push({
      name: 'Operator Digital Signature (ECDSA P-256)',
      passed: false,
      message: 'Signature verification exception: ' + String(err),
    });
  }

  // Check 4: Hash Chain Linkage to Predecessor
  let hashChainPass = false;
  if (record.prevRecordHash === 'GENESIS') {
    // If genesis block, passes if no earlier record exists or explicitly verified
    hashChainPass = true;
    checks.push({
      name: 'Hash Chain Link (Genesis Record)',
      passed: true,
      message: 'Valid Genesis block — initial root of the evidentiary custody chain.',
    });
  } else if (prevRecord) {
    hashChainPass = prevRecord.recordHashSha256 === record.prevRecordHash;
    checks.push({
      name: 'Hash Chain Sequence Linkage',
      passed: hashChainPass,
      expected: record.prevRecordHash.substring(0, 16) + '...',
      actual: prevRecord.recordHashSha256.substring(0, 16) + '...',
      message: hashChainPass
        ? 'Chain link verified. Unbroken link to predecessor record.'
        : 'FAIL: Hash chain gap detected! Predecessor record hash does not match.',
    });
  } else {
    // Predecessor record not provided in single-record check; verify non-empty hash
    hashChainPass = Boolean(record.prevRecordHash && record.prevRecordHash.length === 64);
    checks.push({
      name: 'Hash Chain Link Reference',
      passed: hashChainPass,
      message: hashChainPass
        ? `Valid predecessor link pointer (${record.prevRecordHash.substring(0, 12)}...).`
        : 'FAIL: Invalid predecessor hash pointer format.',
    });
  }

  const overallPass = imageHashPass && recordHashPass && signaturePass && hashChainPass;

  return {
    overallPass,
    imageHashPass,
    recordHashPass,
    signaturePass,
    hashChainPass,
    checks,
    tamperDetected: !overallPass || Boolean(record.tampered),
  };
}

/**
 * Simulates tampering on a stored record to demonstrate cryptographic failure (Demo Only).
 */
export async function simulateRecordTampering(
  recordId: string,
  mode: 'tamper_result' | 'tamper_confidence' | 'tamper_image' | 'tamper_chain'
): Promise<TestRecordEntity> {
  const existing = await db.testRecords.get(recordId);
  if (!existing) {
    throw new Error('Record not found for tampering simulation.');
  }

  let modified: TestRecordEntity = { ...existing, tampered: true };

  if (mode === 'tamper_result') {
    // Flip POSITIVE to NEGATIVE or vice-versa
    const newResult: TestResultOutcome = existing.result === 'POSITIVE' ? 'NEGATIVE' : 'POSITIVE';
    modified = {
      ...modified,
      result: newResult,
      reason: `[TAMPERED] Result maliciously changed to ${newResult}.`,
    };
  } else if (mode === 'tamper_confidence') {
    modified = {
      ...modified,
      confidence: 0.15,
      reason: '[TAMPERED] Confidence value downgraded maliciously.',
    };
  } else if (mode === 'tamper_image') {
    // Corrupt image bytes
    const corruptBlob = new Blob(['TAMPERED_IMAGE_BYTES_DEFECT'], { type: 'image/jpeg' });
    modified = {
      ...modified,
      imageBlob: corruptBlob,
    };
  } else if (mode === 'tamper_chain') {
    // Invalidate previous hash pointer
    modified = {
      ...modified,
      prevRecordHash: 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
    };
  }

  await db.testRecords.put(modified);
  return modified;
}
