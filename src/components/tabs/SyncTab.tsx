/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  RefreshCw,
  Server,
  AlertCircle,
  WifiOff,
  Wifi,
  CheckCircle2,
  ShieldAlert,
  Clock,
  Layers,
  Send,
  Sliders,
  Flame,
  Check,
  Terminal,
  RotateCcw,
  Sparkles,
  Cloud,
  Database,
  LogIn,
  LogOut as LogOutIcon,
  ShieldCheck,
} from 'lucide-react';
import { useOnlineStatus } from '../OfflineIndicator.tsx';
import type { OperatorProfile, TestRecordEntity } from '../../types/index.ts';
import { db } from '../../db/index.ts';
import {
  executeBatchSync,
  isBackgroundSyncSupported,
  registerBackgroundSync,
  type SyncOptions,
} from '../../lib/syncService.ts';
import {
  auth,
  signInWithGoogle,
  logOut,
  syncRecordToCloud,
} from '../../lib/firebase.ts';
import type { User } from 'firebase/auth';

interface SyncTabProps {
  operator: OperatorProfile | null;
}

interface LogEntry {
  id: string;
  time: string;
  text: string;
  type: 'info' | 'success' | 'warn' | 'error';
}

export const SyncTab: React.FC<SyncTabProps> = ({ operator }) => {
  const isOnline = useOnlineStatus();

  // Queue counts
  const [totalCount, setTotalCount] = useState<number>(0);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [syncedCount, setSyncedCount] = useState<number>(0);
  const [failedCount, setFailedCount] = useState<number>(0);

  // Sync state
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // Simulator controls
  const [networkMode, setNetworkMode] = useState<'ONLINE' | 'LATENCY' | 'OFFLINE'>('ONLINE');
  const [serverRejectionMode, setServerRejectionMode] = useState<'STANDARD' | 'FORCE_500' | 'FORCE_403'>('STANDARD');
  const [bgSyncSupported, setBgSyncSupported] = useState<boolean>(false);

  // Firebase Cloud State
  const [firebaseUser, setFirebaseUser] = useState<User | null>(auth.currentUser);
  const [isCloudSyncing, setIsCloudSyncing] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setFirebaseUser(user);
    });
    return () => unsubscribe();
  }, []);

  const handleGoogleSignIn = async () => {
    addLog('Opening Google Authentication popup...', 'info');
    try {
      const user = await signInWithGoogle();
      if (user) {
        addLog(`Authenticated as ${user.email} (${user.uid.substring(0, 8)}...)`, 'success');
      }
    } catch (err) {
      addLog(`Sign in failed: ${err instanceof Error ? err.message : String(err)}`, 'error');
    }
  };

  const handleGoogleSignOut = async () => {
    try {
      await logOut();
      addLog('Signed out of Firebase Cloud.', 'info');
    } catch (err) {
      addLog(`Sign out error: ${err instanceof Error ? err.message : String(err)}`, 'error');
    }
  };

  const handleSyncToFirestore = async () => {
    if (!firebaseUser) {
      addLog('Authentication required: Please sign in with Google to sync to Cloud Firestore.', 'warn');
      return;
    }

    setIsCloudSyncing(true);
    addLog('Commencing upload of local custody records to Cloud Firestore /records...', 'info');

    try {
      const records = await db.testRecords.toArray();
      let uploaded = 0;
      for (const rec of records) {
        try {
          const success = await syncRecordToCloud(rec);
          if (success) {
            uploaded++;
            await db.testRecords.update(rec.id, {
              syncStatus: 'synced',
              syncedAtIso: new Date().toISOString(),
            });
          }
        } catch (itemErr) {
          console.warn(`Failed to upload record ${rec.id}:`, itemErr);
        }
      }
      addLog(`Successfully uploaded ${uploaded} of ${records.length} records to Cloud Firestore.`, 'success');
      loadQueueStats();
    } catch (err) {
      addLog(`Cloud sync encountered error: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      setIsCloudSyncing(false);
    }
  };

  const addLog = (text: string, type: 'info' | 'success' | 'warn' | 'error' = 'info') => {
    const entry: LogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      time: new Date().toLocaleTimeString(),
      text,
      type,
    };
    setLogs((prev) => [entry, ...prev.slice(0, 40)]);
  };

  const loadQueueStats = async () => {
    try {
      const records = await db.testRecords.toArray();
      setTotalCount(records.length);
      setPendingCount(records.filter((r) => r.syncStatus === 'pending').length);
      setSyncedCount(records.filter((r) => r.syncStatus === 'synced').length);
      setFailedCount(records.filter((r) => r.syncStatus === 'failed').length);
    } catch (err) {
      console.error('Failed to load queue stats:', err);
    }
  };

  useEffect(() => {
    loadQueueStats();
    setBgSyncSupported(isBackgroundSyncSupported());
  }, []);

  const handleSyncNow = async () => {
    setIsSyncing(true);
    addLog(`Initiating manual synchronization (${networkMode} / ${serverRejectionMode})...`, 'info');

    try {
      const res = await executeBatchSync({
        networkMode,
        serverRejectionMode,
        latencyMs: 2500,
        onLogMessage: (msg, type) => addLog(msg, type),
      });

      if (res.acceptedCount > 0) {
        addLog(
          `Batch sync complete: ${res.acceptedCount} records successfully countersigned by server.`,
          'success'
        );
      }
    } catch (err) {
      addLog(`Sync halted: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      setIsSyncing(false);
      loadQueueStats();
    }
  };

  // Reset all records to pending to re-test synchronization
  const handleResetSyncState = async () => {
    const all = await db.testRecords.toArray();
    for (const r of all) {
      await db.testRecords.update(r.id, {
        syncStatus: 'pending',
        syncedAtIso: undefined,
        serverCounterSignature: undefined,
      });
    }
    addLog('Reset all local records to "pending sync" state.', 'info');
    loadQueueStats();
  };

  // Inject a simulated tampered record into the queue to test server rejection
  const handleInjectTamperedRecord = async () => {
    const last = await db.testRecords.orderBy('timestampIso').last();
    const fakeRecord: TestRecordEntity = {
      id: crypto.randomUUID(),
      timestampIso: new Date().toISOString(),
      bootClockMs: performance.now(),
      gps: {
        latitude: 37.7749,
        longitude: -122.4194,
        accuracyMeters: 5.0,
        timestampIso: new Date().toISOString(),
        status: 'FIXED',
      },
      operatorId: operator?.operatorId || 'Officer J. Doe',
      badgeUnit: operator?.badgeUnit || 'K9-Unit',
      deviceInfo: {
        userAgent: 'Simulated Forensic Device',
        platform: 'Linux x86_64',
        screenResolution: '1920x1080',
      },
      kitProfileId: 'cobalt-thiocyanate',
      kitProfileVersion: '1.0.0',
      algorithmVersion: '1.0.0-ciede2000-matrix',
      result: 'POSITIVE',
      confidence: 0.99,
      reason: '[MALICIOUSLY TAMPERED] Payload altered to test server verification gate.',
      calibrationData: {
        matrix: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
        patches: [],
        meanResidualDeltaE: 2.1,
        quality: 'GOOD',
        rawSampleRgb: [20, 50, 200],
        correctedSampleRgb: [20, 50, 200],
        correctedSampleLab: [38, -12, -42],
      },
      qualityGates: {
        passed: true,
        blurVariance: 120,
        isBlurry: false,
        meanLuminance: 120,
        isUnderExposed: false,
        isOverExposed: false,
        glarePixelPercent: 0,
        hasGlare: false,
        warnings: [],
      },
      imageHashSha256: '0000000000000000000000000000000000000000000000000000000000000000',
      prevRecordHash: last ? last.recordHashSha256 : 'GENESIS',
      publicKeyFingerprint: operator?.keyFingerprint || 'TEST_FINGERPRINT',
      recordHashSha256: 'bad_hash_digest_that_does_not_match_canonical_payload',
      signatureHex: '3045022100deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef0220deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
      syncStatus: 'pending',
      tampered: true,
    };

    await db.testRecords.put(fakeRecord);
    addLog(`Injected simulated tampered record (${fakeRecord.id.substring(0, 8)}...) into pending queue.`, 'warn');
    loadQueueStats();
  };

  return (
    <div className="space-y-4 pb-12 w-full text-left">
      {/* Title */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-300">
        <div>
          <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-slate-900 flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-slate-700" />
            Gateway Synchronization
          </h1>
          <p className="text-xs text-slate-500">
            Cryptographic ledger sync, signature audit, and authority countersigning.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isOnline ? (
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-medium bg-[#e9edf2] text-slate-800 border border-slate-300">
              <Wifi className="w-3.5 h-3.5 text-slate-700" />
              Connected
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-medium bg-slate-200 text-slate-700 border border-slate-300">
              <WifiOff className="w-3.5 h-3.5 text-slate-600" />
              Offline
            </span>
          )}
        </div>
      </div>

      {/* Device-Claimed Timestamp Notice */}
      <div className="bg-[#f4f6fa] border border-slate-300 border-l-4 border-l-[#0a192f] rounded-xl px-4 py-2.5 flex items-center justify-between text-xs shadow-2xs">
        <div className="flex items-center gap-2 text-slate-800">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-slate-700" />
          <span className="font-semibold text-slate-900 text-xs">Offline Timestamps:</span>
          <span className="text-slate-600 text-xs">
            Device clock secured via hash-chain ordering and gateway counter-signatures.
          </span>
        </div>
      </div>

      {/* Sync Queue Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-left">
        <div className="p-4 rounded-xl bg-[#f4f6fa] border border-slate-300 space-y-0.5 shadow-2xs">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block">
            Pending Sync
          </span>
          <div className="text-2xl font-bold text-slate-900">{pendingCount}</div>
          <span className="text-[10px] text-slate-500 font-mono">Awaiting upload</span>
        </div>

        <div className="p-4 rounded-xl bg-[#f4f6fa] border border-slate-300 space-y-0.5 shadow-2xs">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block">
            Countersigned
          </span>
          <div className="text-2xl font-bold text-slate-900">{syncedCount}</div>
          <span className="text-[10px] text-slate-500 font-mono">Authority verified</span>
        </div>

        <div className="p-4 rounded-xl bg-[#f4f6fa] border border-slate-300 space-y-0.5 shadow-2xs">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block">
            Rejected
          </span>
          <div className="text-2xl font-bold text-slate-900">{failedCount}</div>
          <span className="text-[10px] text-slate-500 font-mono">Audit caught</span>
        </div>

        <div className="p-4 rounded-xl bg-[#f4f6fa] border border-slate-300 space-y-0.5 shadow-2xs">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block">
            Ledger Records
          </span>
          <div className="text-2xl font-bold text-slate-900">{totalCount}</div>
          <span className="text-[10px] text-slate-500 font-mono">IndexedDB Total</span>
        </div>
      </div>

      {/* Primary Action Button Bar */}
      <div className="bg-[#f4f6fa] border border-slate-300 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div>
          <h3 className="text-xs font-semibold text-slate-900">Evidence Gateway Status</h3>
          <p className="text-[11px] text-slate-500">
            {pendingCount > 0
              ? `${pendingCount} record${pendingCount > 1 ? 's' : ''} ready to transmit and countersign.`
              : 'Ledger is synchronized with central authority.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSyncNow}
            disabled={isSyncing || pendingCount === 0}
            className="px-4 py-2 rounded-md bg-[#0a192f] hover:bg-[#132847] disabled:opacity-40 text-white font-medium text-xs flex items-center gap-2 cursor-pointer transition shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Synchronizing...' : 'Sync Now'}</span>
          </button>
        </div>
      </div>

      {/* Firebase Cloud Firestore Section */}
      <div className="bg-[#f4f6fa] border border-blue-200/80 rounded-xl p-4 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600/10 border border-blue-600/20 flex items-center justify-center text-blue-700">
              <Cloud className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold text-slate-900">
                  Firebase Cloud Firestore Database
                </h3>
                <span className="text-[10px] font-semibold px-2 py-0.2 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                  Spark Free Tier • Active
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Centralized real-time cloud custody database (Project: <code className="font-mono text-[10px] text-blue-900 bg-blue-50 px-1 py-0.5 rounded">ai-studio-applet-webapp-fe18e</code>)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {firebaseUser ? (
              <div className="flex items-center gap-2">
                <div className="text-right text-[11px] leading-tight">
                  <span className="font-semibold text-slate-900 block truncate max-w-[140px]">
                    {firebaseUser.displayName || firebaseUser.email}
                  </span>
                  <span className="text-[10px] text-emerald-700 font-medium">Cloud Authenticated</span>
                </div>
                <button
                  onClick={handleGoogleSignOut}
                  className="px-2.5 py-1.5 rounded-md bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-medium flex items-center gap-1 cursor-pointer transition"
                  title="Sign out of Firebase"
                >
                  <LogOutIcon className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            ) : (
              <button
                onClick={handleGoogleSignIn}
                className="px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs transition"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In with Google</span>
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="space-y-0.5 text-slate-600 text-[11px]">
            <div>Cloud Collection: <code className="font-mono text-[10px] font-semibold text-slate-900">/records</code> (Cryptographically Sealed)</div>
            <div>Rules Status: <span className="font-semibold text-emerald-700">Hardened &amp; Deployed (Append-Only Immutability)</span></div>
          </div>

          <button
            onClick={handleSyncToFirestore}
            disabled={isCloudSyncing || !firebaseUser}
            className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-semibold text-xs flex items-center gap-2 cursor-pointer transition shadow-2xs"
          >
            <Cloud className={`w-3.5 h-3.5 ${isCloudSyncing ? 'animate-bounce' : ''}`} />
            <span>{isCloudSyncing ? 'Uploading to Firestore...' : 'Sync to Cloud Firestore'}</span>
          </button>
        </div>
      </div>

      {/* Full-Page Two-Column Workstation Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {/* Sync Simulator Controls Panel */}
        <div className="bg-[#f4f6fa] border border-slate-300 rounded-xl p-4 space-y-3 shadow-xs">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-slate-700" />
              <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                Network &amp; Security Simulation Controls
              </h3>
            </div>
            <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-[#e9edf2] text-slate-700 border border-slate-300">
              Testbed
            </span>
          </div>

          {/* Network Conditions */}
          <div className="space-y-1 text-xs">
            <label className="font-medium text-slate-700 block">
              Network Condition:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                onClick={() => setNetworkMode('ONLINE')}
                className={`p-2 rounded-md border text-left font-medium transition flex items-center justify-between cursor-pointer ${
                  networkMode === 'ONLINE'
                    ? 'bg-[#0a192f] border-[#0a192f] text-white shadow-xs'
                    : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div>
                  <div>Normal Online</div>
                  <div className="text-[10px] opacity-75">Instant transfer</div>
                </div>
                {networkMode === 'ONLINE' && <Check className="w-3.5 h-3.5" />}
              </button>

              <button
                onClick={() => setNetworkMode('LATENCY')}
                className={`p-2 rounded-md border text-left font-medium transition flex items-center justify-between cursor-pointer ${
                  networkMode === 'LATENCY'
                    ? 'bg-[#0a192f] border-[#0a192f] text-white shadow-xs'
                    : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div>
                  <div>High Latency</div>
                  <div className="text-[10px] opacity-75">2.5s network delay</div>
                </div>
                {networkMode === 'LATENCY' && <Check className="w-3.5 h-3.5" />}
              </button>

              <button
                onClick={() => setNetworkMode('OFFLINE')}
                className={`p-2 rounded-md border text-left font-medium transition flex items-center justify-between cursor-pointer ${
                  networkMode === 'OFFLINE'
                    ? 'bg-[#0a192f] border-[#0a192f] text-white shadow-xs'
                    : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div>
                  <div>Simulated Offline</div>
                  <div className="text-[10px] opacity-75">Drop connection</div>
                </div>
                {networkMode === 'OFFLINE' && <Check className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Server Policy */}
          <div className="space-y-1 text-xs pt-1">
            <label className="font-medium text-slate-700 block">
              Authority Audit Policy:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                onClick={() => setServerRejectionMode('STANDARD')}
                className={`p-2 rounded-md border text-left font-medium transition flex items-center justify-between cursor-pointer ${
                  serverRejectionMode === 'STANDARD'
                    ? 'bg-[#0a192f] border-[#0a192f] text-white shadow-xs'
                    : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div>
                  <div>Standard Policy</div>
                  <div className="text-[10px] opacity-75">Accept valid signatures</div>
                </div>
                {serverRejectionMode === 'STANDARD' && <Check className="w-3.5 h-3.5" />}
              </button>

              <button
                onClick={() => setServerRejectionMode('FORCE_500')}
                className={`p-2 rounded-md border text-left font-medium transition flex items-center justify-between cursor-pointer ${
                  serverRejectionMode === 'FORCE_500'
                    ? 'bg-[#0a192f] border-[#0a192f] text-white shadow-xs'
                    : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div>
                  <div>Force Error (500)</div>
                  <div className="text-[10px] opacity-75">Simulate server error</div>
                </div>
                {serverRejectionMode === 'FORCE_500' && <Check className="w-3.5 h-3.5" />}
              </button>

              <button
                onClick={() => setServerRejectionMode('FORCE_403')}
                className={`p-2 rounded-md border text-left font-medium transition flex items-center justify-between cursor-pointer ${
                  serverRejectionMode === 'FORCE_403'
                    ? 'bg-[#0a192f] border-[#0a192f] text-white shadow-xs'
                    : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div>
                  <div>Revoke Auth (403)</div>
                  <div className="text-[10px] opacity-75">Reject unauthorized key</div>
                </div>
                {serverRejectionMode === 'FORCE_403' && <Check className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Demo Chaos Triggers */}
          <div className="pt-2 border-t border-slate-200 flex flex-wrap gap-2 text-xs">
            <button
              onClick={handleInjectTamperedRecord}
              className="px-3 py-1.5 rounded-md bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 font-medium flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
            >
              <Flame className="w-3.5 h-3.5 text-slate-700" />
              <span>Inject Tampered Record</span>
            </button>

            <button
              onClick={handleResetSyncState}
              className="px-3 py-1.5 rounded-md bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 font-medium flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
              <span>Reset Records to &quot;Pending&quot;</span>
            </button>
          </div>
        </div>

        {/* Live Sync Terminal Log */}
        <div className="bg-[#0b1728] border border-slate-800 rounded-xl p-4 space-y-2 text-slate-300 shadow-md">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[11px] font-semibold text-slate-200 uppercase tracking-wider font-mono">
                Gateway Transmission Audit Log
              </span>
            </div>
            <button
              onClick={() => setLogs([])}
              className="text-[10px] text-slate-400 hover:text-white cursor-pointer"
            >
              Clear Log
            </button>
          </div>

          <div className="space-y-1 font-mono text-[11px] min-h-[220px] max-h-[340px] overflow-y-auto pr-1">
            {logs.length === 0 ? (
              <div className="text-slate-500 italic py-8 text-center">
                Awaiting transmission events. Tap &quot;Sync Now&quot; above to begin.
              </div>
            ) : (
              logs.map((l) => (
                <div
                  key={l.id}
                  className="flex items-start gap-2 leading-relaxed text-slate-300"
                >
                  <span className="text-slate-500 flex-shrink-0">[{l.time}]</span>
                  <span>{l.text}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
