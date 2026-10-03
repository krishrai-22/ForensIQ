/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface StoragePersistenceStatus {
  isSupported: boolean;
  isPersisted: boolean;
  quotaBytes?: number;
  usageBytes?: number;
  checkedAt: number;
}

/**
 * Check and request persistent storage quota via navigator.storage.persist()
 */
export async function checkAndRequestStoragePersistence(): Promise<StoragePersistenceStatus> {
  if (typeof navigator === 'undefined' || !navigator.storage || !navigator.storage.persist) {
    return {
      isSupported: false,
      isPersisted: false,
      checkedAt: Date.now(),
    };
  }

  try {
    // Check if already persisted
    let isPersisted = await navigator.storage.persisted();

    // If not, request persistence
    if (!isPersisted) {
      isPersisted = await navigator.storage.persist();
    }

    let quotaBytes: number | undefined;
    let usageBytes: number | undefined;

    if (navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      quotaBytes = estimate.quota;
      usageBytes = estimate.usage;
    }

    return {
      isSupported: true,
      isPersisted,
      quotaBytes,
      usageBytes,
      checkedAt: Date.now(),
    };
  } catch (error) {
    console.warn('Storage persistence request failed:', error);
    return {
      isSupported: true,
      isPersisted: false,
      checkedAt: Date.now(),
    };
  }
}
