/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface OperatorProfile {
  id: string; // e.g. 'current'
  operatorId: string;
  badgeUnit: string;
  department?: string;
  createdAtIso: string;
  keyFingerprint: string;
  publicKeySpkiBase64: string;
  publicKeyJwk?: JsonWebKey;
}

export interface StoredCryptoKey {
  id: string; // e.g. 'operator-key'
  privateKey: CryptoKey;
  publicKey: CryptoKey;
  createdAt: number;
}

export type TestResultOutcome = 'POSITIVE' | 'NEGATIVE' | 'INCONCLUSIVE';

export interface PatchReading {
  name: string; // 'white' | 'mid-grey' | 'black' | 'red' | 'green' | 'blue'
  measuredRgb: [number, number, number];
  targetRgb: [number, number, number];
  deltaE?: number;
}

export interface CalibrationData {
  matrix: number[][]; // 3x3 colour correction matrix
  patches: PatchReading[];
  meanResidualDeltaE: number;
  quality: 'GOOD' | 'ACCEPTABLE' | 'POOR';
  rawSampleRgb: [number, number, number];
  correctedSampleRgb: [number, number, number];
  correctedSampleLab: [number, number, number];
}

export interface QualityGateResult {
  passed: boolean;
  blurVariance: number;
  isBlurry: boolean;
  meanLuminance: number;
  isUnderExposed: boolean;
  isOverExposed: boolean;
  glarePixelPercent: number;
  hasGlare: boolean;
  warnings: string[];
}

export interface GpsData {
  latitude: number | null;
  longitude: number | null;
  accuracyMeters: number | null;
  timestampIso: string | null;
  status: 'FIXED' | 'UNAVAILABLE' | 'DENIED' | 'TIMEOUT';
}

export interface SignedTestRecord {
  id: string; // UUID v4
  timestampIso: string; // ISO 8601
  bootClockMs: number; // monotonic performance.now() + boot baseline
  gps: GpsData;
  operatorId: string;
  badgeUnit: string;
  deviceInfo: {
    userAgent: string;
    platform: string;
    screenResolution: string;
  };
  kitProfileId: string;
  kitProfileVersion: string;
  algorithmVersion: string;
  result: TestResultOutcome;
  confidence: number; // 0.00 to 1.00
  reason: string; // Plain-language explanation
  reactionElapsedSeconds?: number;
  reactionTimeFlag?: 'ON_TIME' | 'EARLY' | 'LATE';
  calibrationData: CalibrationData;
  qualityGates: QualityGateResult;
  cardQualityGates?: QualityGateResult;
  imageHashSha256: string;
  sampleImageHashSha256?: string;
  referenceCardImageHashSha256?: string;
  prevRecordHash: string; // "GENESIS" or SHA-256 of prev canonical record
  recordHashSha256: string;
  signatureHex: string;
  publicKeyFingerprint: string;
  syncStatus: 'pending' | 'synced' | 'failed';
  syncedAtIso?: string;
  serverCounterSignature?: string;
  tampered?: boolean;
}

export interface TestRecordEntity extends SignedTestRecord {
  imageBlob?: Blob; // Stored in IndexedDB alongside the record
  sampleImageBlob?: Blob;
  referenceCardImageBlob?: Blob;
}

export interface KitProfileOutcome {
  id: string;
  label: string;
  category: 'POSITIVE' | 'NEGATIVE' | 'INCONCLUSIVE';
  referenceLab: [number, number, number]; // [L*, a*, b*]
  toleranceDeltaE: number;
  description: string;
}

export interface KitProfile {
  id: string;
  name: string;
  substanceClass: string; // e.g. "Cocaine / Crack Presumptive Reagent"
  requiredReadTimeSeconds: number;
  readTimeToleranceSeconds: number;
  reagentSteps: string[];
  disclaimer: string;
  version: string;
  outcomes: KitProfileOutcome[];
}
