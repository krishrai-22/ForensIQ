/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import Dexie, { type Table } from 'dexie';
import type { OperatorProfile, StoredCryptoKey, TestRecordEntity } from '../types/index.ts';
import {
  generateOperatorKeyPair,
  calculatePublicKeyFingerprint,
  exportPublicKeyJwk,
} from '../lib/crypto.ts';

export class FieldTestDatabase extends Dexie {
  operatorProfile!: Table<OperatorProfile, string>;
  cryptoKeys!: Table<StoredCryptoKey, string>;
  testRecords!: Table<TestRecordEntity, string>;

  constructor() {
    super('FieldTestCompanionDB');
    this.version(1).stores({
      operatorProfile: 'id, operatorId, badgeUnit, createdAtIso',
      cryptoKeys: 'id, createdAt',
      testRecords: 'id, timestampIso, operatorId, kitProfileId, result, syncStatus',
    });
  }
}

export const db = new FieldTestDatabase();

/**
 * Fetch existing operator profile if one has been set up.
 */
export async function getStoredOperatorProfile(): Promise<OperatorProfile | null> {
  const profile = await db.operatorProfile.get('current');
  return profile || null;
}

/**
 * Fetch stored cryptographic keys.
 */
export async function getStoredOperatorCryptoKey(): Promise<StoredCryptoKey | null> {
  const record = await db.cryptoKeys.get('operator-key');
  return record || null;
}

/**
 * Setup operator profile and generate non-extractable ECDSA P-256 keypair.
 * This runs on first launch or when explicitly re-enrolled.
 */
export async function initializeOperatorProfile(
  operatorId: string,
  badgeUnit: string,
  department = 'Narcotics Field Enforcement'
): Promise<{ profile: OperatorProfile; keyPair: CryptoKeyPair }> {
  // 1. Generate ECDSA P-256 keypair with non-extractable private key
  const keyPair = await generateOperatorKeyPair();

  // 2. Export public key details
  const { fingerprint, spkiBase64 } = await calculatePublicKeyFingerprint(keyPair.publicKey);
  const jwk = await exportPublicKeyJwk(keyPair.publicKey);

  const profile: OperatorProfile = {
    id: 'current',
    operatorId: operatorId.trim(),
    badgeUnit: badgeUnit.trim(),
    department: department.trim(),
    createdAtIso: new Date().toISOString(),
    keyFingerprint: fingerprint,
    publicKeySpkiBase64: spkiBase64,
    publicKeyJwk: jwk,
  };

  const storedCrypto: StoredCryptoKey = {
    id: 'operator-key',
    privateKey: keyPair.privateKey,
    publicKey: keyPair.publicKey,
    createdAt: Date.now(),
  };

  await db.transaction('rw', db.operatorProfile, db.cryptoKeys, async () => {
    await db.operatorProfile.put(profile);
    await db.cryptoKeys.put(storedCrypto);
  });

  return { profile, keyPair };
}

/**
 * Update operator metadata (e.g. badge/unit) without touching the cryptographic key.
 */
export async function updateOperatorMetadata(
  operatorId: string,
  badgeUnit: string,
  department?: string
): Promise<OperatorProfile> {
  const existing = await getStoredOperatorProfile();
  if (!existing) {
    throw new Error('No existing operator profile found to update.');
  }

  const updated: OperatorProfile = {
    ...existing,
    operatorId: operatorId.trim(),
    badgeUnit: badgeUnit.trim(),
    department: department ? department.trim() : existing.department,
  };

  await db.operatorProfile.put(updated);
  return updated;
}

/**
 * Log out and remove active operator session.
 */
export async function clearOperatorProfile(): Promise<void> {
  await db.transaction('rw', db.operatorProfile, db.cryptoKeys, async () => {
    await db.operatorProfile.clear();
    await db.cryptoKeys.clear();
  });
}

