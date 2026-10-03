import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  collection,
  setDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import type { TestRecordEntity } from '../types/index.ts';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase SDK
const app = initializeApp(firebaseConfig);

// CRITICAL: Must pass firestoreDatabaseId per instructions
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test initial connection to Firestore
export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client is offline or network is limited.');
      return false;
    }
    // Connection test doc may not exist, which is fine as long as network reachable
    return true;
  }
}

// Immediately test connection in background
testConnection().catch((err) => console.warn('Initial connection probe completed:', err));

// Sign in with Google using popup
export async function signInWithGoogle(): Promise<User | null> {
  try {
    const cred = await signInWithPopup(auth, googleProvider);
    if (cred.user) {
      // Upsert user profile
      const userRef = doc(db, 'users', cred.user.uid);
      await setDoc(
        userRef,
        {
          userId: cred.user.uid,
          email: cred.user.email || '',
          displayName: cred.user.displayName || 'Field Officer',
          role: 'officer',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      ).catch((e) => {
        console.warn('Could not update user profile doc:', e);
      });
    }
    return cred.user;
  } catch (error) {
    console.error('Google Sign In error:', error);
    return null;
  }
}

// Sign out
export async function logOut(): Promise<void> {
  await signOut(auth);
}

// Sync an evidence record up to Firestore
export async function syncRecordToCloud(record: TestRecordEntity): Promise<boolean> {
  if (!auth.currentUser) {
    return false;
  }

  const recordPath = `records/${record.id}`;
  try {
    // Sanitize record to plain JSON object (avoid non-serializable blobs in Firestore document)
    const cloudPayload: Record<string, unknown> = {
      id: record.id,
      timestampIso: record.timestampIso,
      bootClockMs: record.bootClockMs,
      operatorId: record.operatorId,
      badgeUnit: record.badgeUnit,
      kitProfileId: record.kitProfileId,
      kitProfileVersion: record.kitProfileVersion,
      result: record.result,
      confidence: record.confidence,
      reason: record.reason,
      recordHashSha256: record.recordHashSha256,
      imageHashSha256: record.imageHashSha256,
      prevRecordHash: record.prevRecordHash,
      publicKeyFingerprint: record.publicKeyFingerprint,
      signatureHex: record.signatureHex,
      tampered: Boolean(record.tampered),
      userId: auth.currentUser.uid,
      createdAt: new Date().toISOString(),
    };

    if (record.reactionElapsedSeconds !== undefined) {
      cloudPayload.reactionElapsedSeconds = record.reactionElapsedSeconds;
    }
    if (record.reactionTimeFlag) {
      cloudPayload.reactionTimeFlag = record.reactionTimeFlag;
    }
    if (record.gps) {
      cloudPayload.gps = {
        latitude: record.gps.latitude,
        longitude: record.gps.longitude,
        accuracyMeters: record.gps.accuracyMeters,
      };
    }

    await setDoc(doc(db, 'records', record.id), cloudPayload);
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, recordPath);
  }
}

// Subscribe to real-time cloud records
export function subscribeToCloudRecords(
  onRecords: (records: Record<string, unknown>[]) => void,
  onError?: (err: Error) => void
): () => void {
  const recordsCol = collection(db, 'records');
  const q = query(recordsCol, orderBy('timestampIso', 'desc'), limit(100));

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const records: Record<string, unknown>[] = [];
      snapshot.forEach((d) => {
        records.push(d.data());
      });
      onRecords(records);
    },
    (error) => {
      console.warn('Real-time cloud subscription error:', error);
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, 'records');
    }
  );

  return unsubscribe;
}
