/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { db, getStoredOperatorProfile } from '../db/index.ts';
import type { TestRecordEntity, SignedTestRecord } from '../types/index.ts';

export interface SyncOptions {
  networkMode: 'ONLINE' | 'LATENCY' | 'OFFLINE';
  serverRejectionMode: 'STANDARD' | 'FORCE_500' | 'FORCE_403';
  latencyMs?: number;
  onLogMessage?: (msg: string, type?: 'info' | 'success' | 'warn' | 'error') => void;
}

export interface SyncBatchResult {
  totalProcessed: number;
  acceptedCount: number;
  rejectedCount: number;
  acceptedIds: string[];
  rejectedItems: { id: string; reason: string }[];
  serverTimestampIso?: string;
  error?: string;
}

/**
 * Check if the browser supports the W3C Background Sync API
 */
export function isBackgroundSyncSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'SyncManager' in window
  );
}

/**
 * Register a Background Sync event for offline recovery
 */
export async function registerBackgroundSync(): Promise<boolean> {
  if (!isBackgroundSyncSupported()) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    // @ts-expect-error SyncManager is experimental in some TypeScript lib targets
    if (reg.sync) {
      // @ts-expect-error SyncManager
      await reg.sync.register('sync-evidence-records');
      return true;
    }
    return false;
  } catch (err) {
    console.warn('Background sync registration failed:', err);
    return false;
  }
}

/**
 * Enrols the active operator's public key with the central server
 */
export async function enrolOperatorWithServer(
  onLog?: (msg: string, type?: 'info' | 'success' | 'warn' | 'error') => void
): Promise<boolean> {
  const profile = await getStoredOperatorProfile();
  if (!profile) return false;

  try {
    const res = await fetch('/api/enrol-officer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operatorId: profile.operatorId,
        badgeUnit: profile.badgeUnit,
        publicKeySpkiBase64: profile.publicKeySpkiBase64,
        keyFingerprint: profile.keyFingerprint,
      }),
    });

    if (res.ok) {
      if (onLog) onLog(`Enrolled operator ${profile.operatorId} with authority server.`, 'success');
      return true;
    }
  } catch (err) {
    if (onLog) onLog(`Authority enrolment request failed (operating offline).`, 'warn');
  }
  return false;
}

/**
 * Executes a batch sync of pending and failed records
 */
export async function executeBatchSync(options: SyncOptions): Promise<SyncBatchResult> {
  const { networkMode, serverRejectionMode, latencyMs = 2500, onLogMessage } = options;
  const log = onLogMessage || (() => {});

  log('Beginning synchronization pipeline...', 'info');

  // 1. Check Simulated Network Condition
  if (networkMode === 'OFFLINE') {
    log('Network drop simulated: Device is in airplane/offline mode.', 'error');
    throw new Error('Network offline (Simulated Network Failure)');
  }

  if (networkMode === 'LATENCY') {
    log(`High-latency 3G connection simulated: Waiting ${latencyMs}ms...`, 'warn');
    await new Promise((r) => setTimeout(r, latencyMs));
  }

  // 2. Fetch pending or failed records from IndexedDB
  const allRecords = await db.testRecords.toArray();
  const pendingRecords = allRecords.filter(
    (r) => r.syncStatus === 'pending' || r.syncStatus === 'failed'
  );

  if (pendingRecords.length === 0) {
    log('All records are already synced. Queue is empty.', 'success');
    return {
      totalProcessed: 0,
      acceptedCount: 0,
      rejectedCount: 0,
      acceptedIds: [],
      rejectedItems: [],
    };
  }

  log(`Found ${pendingRecords.length} records in queue awaiting transmission.`, 'info');

  // Enrol officer credentials first
  await enrolOperatorWithServer(log);

  // Prepare batch payload (exclude heavy client image blobs from JSON payload, include hash and metadata)
  const payloadRecords = pendingRecords.map((r) => {
    const { imageBlob, ...recordMeta } = r;
    return recordMeta;
  });

  let simulateParam: string | undefined = undefined;
  if (serverRejectionMode === 'FORCE_500') simulateParam = 'force_server_error';
  if (serverRejectionMode === 'FORCE_403') simulateParam = 'force_auth_error';

  log(`Transmitting batch of ${payloadRecords.length} records to /api/sync-batch...`, 'info');

  try {
    const response = await fetch('/api/sync-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        records: payloadRecords,
        simulateMode: simulateParam,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      log(`Server returned HTTP ${response.status}: ${errText}`, 'error');

      // Mark records as failed in local DB
      for (const rec of pendingRecords) {
        await db.testRecords.update(rec.id, { syncStatus: 'failed' });
      }

      throw new Error(`Server returned HTTP ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const { acceptedRecords = [], rejectedRecords = [], serverTimestampIso } = data;

    log(
      `Server batch evaluation: ${acceptedRecords.length} accepted, ${rejectedRecords.length} rejected.`,
      acceptedRecords.length > 0 ? 'success' : 'warn'
    );

    // Update accepted records in IndexedDB
    const acceptedIds: string[] = [];
    for (const acc of acceptedRecords) {
      acceptedIds.push(acc.id);
      await db.testRecords.update(acc.id, {
        syncStatus: 'synced',
        syncedAtIso: acc.syncedAtIso || serverTimestampIso || new Date().toISOString(),
        serverCounterSignature: acc.serverCounterSignature,
      });
      log(`Record ${acc.id.substring(0, 8)}... ACCEPTED & Countersigned by authority.`, 'success');
    }

    // Update rejected records in IndexedDB
    for (const rej of rejectedRecords) {
      await db.testRecords.update(rej.id, {
        syncStatus: 'failed',
      });
      log(`Record ${rej.id.substring(0, 8)}... REJECTED by server: ${rej.reason}`, 'error');
    }

    return {
      totalProcessed: pendingRecords.length,
      acceptedCount: acceptedRecords.length,
      rejectedCount: rejectedRecords.length,
      acceptedIds,
      rejectedItems: rejectedRecords,
      serverTimestampIso,
    };
  } catch (err) {
    log(`Transmission error: ${err instanceof Error ? err.message : String(err)}`, 'error');
    throw err;
  }
}
