/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Key,
  Download,
  Copy,
  Check,
  HardDrive,
  Shield,
  Smartphone,
  RefreshCw,
  Info,
  ExternalLink,
  UserCheck,
  LogOut,
} from 'lucide-react';
import type { OperatorProfile } from '../../types/index.ts';
import type { StoragePersistenceStatus } from '../../lib/storage.ts';
import { checkAndRequestStoragePersistence } from '../../lib/storage.ts';
import { usePWAInstall } from '../../hooks/usePWAInstall.ts';
import { useOnlineStatus } from '../OfflineIndicator.tsx';

interface SettingsTabProps {
  operator: OperatorProfile | null;
  storageStatus: StoragePersistenceStatus | null;
  onRefreshStorage: () => Promise<void>;
  onReEnroll: () => void;
  onLogout?: () => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  operator,
  storageStatus,
  onRefreshStorage,
  onReEnroll,
  onLogout,
}) => {
  const [copiedFingerprint, setCopiedFingerprint] = useState(false);
  const [copiedSpki, setCopiedSpki] = useState(false);
  const [isRequestingStorage, setIsRequestingStorage] = useState(false);
  const [storageMessage, setStorageMessage] = useState<string | null>(null);

  const { isInstallable, isInstalled, install } = usePWAInstall();
  const isOnline = useOnlineStatus();

  const handleCopy = async (text: string, type: 'fingerprint' | 'spki') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'fingerprint') {
        setCopiedFingerprint(true);
        setTimeout(() => setCopiedFingerprint(false), 2000);
      } else {
        setCopiedSpki(true);
        setTimeout(() => setCopiedSpki(false), 2000);
      }
    } catch {
      // fallback
    }
  };

  const handleExportPublicKeyBundle = () => {
    if (!operator) return;

    const bundle = {
      exportType: 'FIELDTEST_OPERATOR_PUBLIC_KEY_ENROLMENT',
      version: '1.0.0',
      exportedAtIso: new Date().toISOString(),
      operator: {
        operatorId: operator.operatorId,
        badgeUnit: operator.badgeUnit,
        department: operator.department,
        enrolledAtIso: operator.createdAtIso,
      },
      cryptographicIdentity: {
        algorithm: 'ECDSA',
        namedCurve: 'P-256',
        hash: 'SHA-256',
        keyFingerprintSha256: operator.keyFingerprint,
        publicKeySpkiDerBase64: operator.publicKeySpkiBase64,
        publicKeyJwk: operator.publicKeyJwk,
      },
      instructionsForServer:
        'Store this public key against the operator ID to verify tamper-evident field test signatures.',
    };

    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fieldtest-enrolment-${operator.operatorId.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleRequestStorage = async () => {
    setIsRequestingStorage(true);
    setStorageMessage(null);
    try {
      const res = await checkAndRequestStoragePersistence();
      await onRefreshStorage();
      if (res.isPersisted) {
        setStorageMessage('Storage persistence successfully granted by browser.');
      } else {
        setStorageMessage('Storage persistence not granted. Browser may evict data under disk pressure.');
      }
    } catch (e) {
      setStorageMessage('Failed to request persistence: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setIsRequestingStorage(false);
    }
  };

  return (
    <div className="space-y-4 pb-12 w-full text-left">
      {/* Title */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-300">
        <div>
          <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-slate-900 flex items-center gap-2">
            <Shield className="w-4 h-4 text-slate-700" />
            Device &amp; Operator Security
          </h1>
          <p className="text-xs text-slate-500">
            Hardware-bound cryptographic keys, public key certificates, and storage persistence.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {/* Operator Identity Card */}
        <div className="rounded-xl bg-[#f4f6fa] border border-slate-300 p-5 space-y-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-[#e9edf2] border border-slate-300 flex items-center justify-center text-slate-700 shadow-2xs">
                <UserCheck className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-xs font-semibold text-slate-900">Enrolled Operator Identity</h2>
                <p className="text-[11px] text-slate-500">Recorded on every signed colorimetric custody record.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {operator && onLogout && (
                <button
                  onClick={onLogout}
                  className="px-2.5 py-1 rounded-md bg-white hover:bg-red-50 text-red-600 border border-red-200 hover:border-red-300 text-xs font-medium transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                  title="Log out of active operator session"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Logout</span>
                </button>
              )}
              <button
                onClick={onReEnroll}
                className="px-2.5 py-1 rounded-md bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-medium transition cursor-pointer shadow-2xs"
              >
                Re-Enroll
              </button>
            </div>
          </div>

          {operator ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
              <div className="bg-[#e9edf2] p-3 rounded-lg border border-slate-300/80 shadow-2xs">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Operator ID</span>
                <p className="text-xs font-semibold text-slate-900 mt-0.5">{operator.operatorId}</p>
              </div>
              <div className="bg-[#e9edf2] p-3 rounded-lg border border-slate-300/80 shadow-2xs">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Badge &amp; Unit</span>
                <p className="text-xs font-semibold text-slate-900 mt-0.5">{operator.badgeUnit}</p>
              </div>
              <div className="bg-[#e9edf2] p-3 rounded-lg border border-slate-300/80 shadow-2xs">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Department</span>
                <p className="text-xs font-semibold text-slate-900 mt-0.5 truncate">{operator.department || 'Narcotics'}</p>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-lg bg-[#e9edf2] border border-slate-300 text-xs text-slate-700">
              No operator credentials loaded. Tap <strong>Re-Enroll</strong> to generate your device keypair.
            </div>
          )}
        </div>

        {/* Cryptographic Key & Server Enrolment Card */}
        <div className="rounded-xl bg-[#f4f6fa] border border-slate-300 p-5 space-y-3.5 shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#e9edf2] border border-slate-300 flex items-center justify-center text-slate-700 shadow-2xs">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs font-semibold text-slate-900">Device ECDSA P-256 Keypair</h2>
              <p className="text-[11px] text-slate-500">
                Non-extractable private key in IndexedDB. Public key used for audit verification.
              </p>
            </div>
          </div>

          {operator && (
            <div className="space-y-3 pt-1">
              {/* Key Fingerprint */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                    Public Key Fingerprint (SHA-256)
                  </span>
                  <button
                    onClick={() => handleCopy(operator.keyFingerprint, 'fingerprint')}
                    className="flex items-center gap-1 text-[11px] text-slate-700 hover:text-slate-900 font-medium cursor-pointer"
                  >
                    {copiedFingerprint ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedFingerprint ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <div className="p-2.5 rounded-lg bg-[#e9edf2] font-mono text-[11px] text-slate-800 border border-slate-300 break-all select-all shadow-2xs">
                  {operator.keyFingerprint}
                </div>
              </div>

              {/* Export Public Key Button */}
              <div className="pt-1 flex flex-col sm:flex-row gap-2">
                <button
                  onClick={handleExportPublicKeyBundle}
                  className="flex-1 py-2 px-3 rounded-md bg-[#0a192f] hover:bg-[#132847] text-white font-medium text-xs flex items-center justify-center gap-2 cursor-pointer transition shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export Certificate (JSON)</span>
                </button>

                <button
                  onClick={() => handleCopy(operator.publicKeySpkiBase64, 'spki')}
                  className="py-2 px-3 rounded-md bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 font-medium text-xs flex items-center justify-center gap-2 cursor-pointer transition shadow-2xs"
                >
                  {copiedSpki ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedSpki ? 'Copied' : 'Copy SPKI Base64'}</span>
                </button>
              </div>

              {/* Security Guarantee callout */}
              <div className="p-3 rounded-lg bg-[#e9edf2] border border-slate-300/80 text-[11px] text-slate-600 space-y-0.5">
                <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-slate-700" />
                  <span>Cryptographic Key Isolation:</span>
                </div>
                <p className="leading-relaxed">
                  Private key property: <code>CryptoKey.extractable = false</code>. The private key cannot be accessed by scripts, exported, or copied off-device.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Storage Persistence & Offline Card - Full Width */}
      <div className="rounded-xl bg-[#f4f6fa] border border-slate-300 p-5 space-y-3.5 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-[#e9edf2] border border-slate-300 flex items-center justify-center text-slate-700 shadow-2xs">
            <HardDrive className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-semibold text-slate-900">Storage &amp; Offline Persistence</h2>
            <p className="text-[11px] text-slate-500">IndexedDB database, browser eviction policy, and PWA cache.</p>
          </div>
        </div>

        <div className="space-y-2.5 pt-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Persistence Status */}
            <div className="p-3.5 rounded-lg bg-[#e9edf2] border border-slate-300/80 space-y-1 shadow-2xs">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Persistence Protection
              </span>
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    storageStatus?.isPersisted ? 'bg-emerald-600' : 'bg-slate-400'
                  }`}
                />
                <span className="text-xs font-semibold text-slate-900">
                  {storageStatus?.isPersisted ? 'Guaranteed (Persisted)' : 'Standard (Not Guaranteed)'}
                </span>
              </div>
            </div>

            {/* Storage Quota */}
            <div className="p-3.5 rounded-lg bg-[#e9edf2] border border-slate-300/80 space-y-1 shadow-2xs">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Disk Usage
              </span>
              <p className="text-xs font-semibold text-slate-900">
                {storageStatus?.usageBytes !== undefined && storageStatus.quotaBytes !== undefined
                  ? `${((storageStatus.usageBytes) / (1024 * 1024)).toFixed(2)} MB / ${(
                      storageStatus.quotaBytes / (1024 * 1024)
                    ).toFixed(0)} MB`
                  : 'Storage Estimation Available'}
              </p>
            </div>
          </div>

          {storageMessage && (
            <div className="p-2.5 rounded-md bg-white border border-slate-300 text-xs text-slate-800">
              {storageMessage}
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              onClick={handleRequestStorage}
              disabled={isRequestingStorage || storageStatus?.isPersisted}
              className="py-2 px-3 rounded-md bg-white hover:bg-slate-100 disabled:opacity-50 text-slate-800 border border-slate-300 text-xs font-medium transition flex items-center gap-2 cursor-pointer shadow-2xs"
            >
              <HardDrive className="w-3.5 h-3.5 text-slate-600" />
              <span>{isRequestingStorage ? 'Requesting...' : storageStatus?.isPersisted ? 'Persistence Granted' : 'Request Permanent Storage'}</span>
            </button>

            {isInstallable && (
              <button
                onClick={install}
                className="py-2 px-3 rounded-md bg-[#0a192f] hover:bg-[#132847] text-white text-xs font-medium transition flex items-center gap-2 cursor-pointer shadow-2xs"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Install PWA to Device</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Architecture & Legal Compliance Card */}
      <div className="rounded-xl bg-[#f4f6fa] border border-slate-300 p-4 space-y-2 text-xs text-slate-600 leading-relaxed shadow-xs">
        <h3 className="font-semibold text-slate-900 flex items-center gap-1.5 text-xs">
          <Info className="w-3.5 h-3.5 text-slate-600" />
          <span>Architecture &amp; Algorithms</span>
        </h3>
        <p>
          ForensIQ operates completely offline. Captured photos, color calibration matrices, and classification outcomes are hashed and signed locally at the moment of seizure.
        </p>
      </div>
    </div>
  );
};
