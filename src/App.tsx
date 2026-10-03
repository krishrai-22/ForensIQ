/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  FlaskConical,
  FileText,
  RefreshCw,
  Settings,
  Shield,
  User,
  ExternalLink,
  ChevronRight,
  Landmark,
  LogOut,
  Cloud,
} from 'lucide-react';
import { getStoredOperatorProfile, clearOperatorProfile } from './db/index.ts';
import { checkAndRequestStoragePersistence, type StoragePersistenceStatus } from './lib/storage.ts';
import type { OperatorProfile } from './types/index.ts';
import { OfflineIndicator } from './components/OfflineIndicator.tsx';
import { PWAInstallButton } from './components/PWAInstallButton.tsx';
import { OperatorSetupModal } from './components/OperatorSetupModal.tsx';
import { LogoutConfirmModal } from './components/LogoutConfirmModal.tsx';
import { ForensIQLogo } from './components/ForensIQLogo.tsx';
import { TestTab } from './components/tabs/TestTab.tsx';
import { LogTab } from './components/tabs/LogTab.tsx';
import { SyncTab } from './components/tabs/SyncTab.tsx';
import { SettingsTab } from './components/tabs/SettingsTab.tsx';

type TabType = 'test' | 'log' | 'sync' | 'settings';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('test');
  const [operator, setOperator] = useState<OperatorProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [showSetupModal, setShowSetupModal] = useState<boolean>(false);
  const [showLogoutModal, setShowLogoutModal] = useState<boolean>(false);
  const [storageStatus, setStorageStatus] = useState<StoragePersistenceStatus | null>(null);

  // Initialize storage persistence check and load operator on startup
  const initApp = async () => {
    setIsLoading(true);
    try {
      const storageResult = await checkAndRequestStoragePersistence();
      setStorageStatus(storageResult);

      const storedProfile = await getStoredOperatorProfile();
      if (storedProfile) {
        setOperator(storedProfile);
      } else {
        setShowSetupModal(true);
      }
    } catch (err) {
      console.error('App initialization error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    initApp();
  }, []);

  const refreshStorage = async () => {
    const res = await checkAndRequestStoragePersistence();
    setStorageStatus(res);
  };

  const handleSetupComplete = (newProfile: OperatorProfile) => {
    setOperator(newProfile);
    setShowSetupModal(false);
  };

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const handleConfirmLogout = async (andReEnroll = false) => {
    try {
      await clearOperatorProfile();
      setOperator(null);
      setShowLogoutModal(false);
      if (andReEnroll) {
        setShowSetupModal(true);
      }
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  return (
    <div className="min-h-screen bg-[#e6eaef] text-slate-900 flex flex-col font-sans selection:bg-slate-800 selection:text-white antialiased">
      {/* Top Header - Deep Navy Official Portal Style */}
      <header className="sticky top-0 z-30 bg-[#0a192f] text-white border-b border-slate-700/80 shadow-sm">
        {/* Subtle Accent Strip */}
        <div className="h-[2px] w-full bg-gradient-to-r from-blue-600 via-amber-400 to-blue-600 opacity-90" />

        <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10">
          <div className="h-16 flex items-center justify-between gap-4">
            {/* Zone 1: ForensIQ Logo & Title */}
            <div
              className="flex items-center gap-3 shrink-0 cursor-pointer"
              onClick={() => setActiveTab('test')}
              title="ForensIQ - Return to Chemical Test"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-b from-[#0f2444] to-[#071324] border border-blue-500/40 flex items-center justify-center text-sky-400 shadow-md transition hover:border-blue-400">
                <ForensIQLogo className="w-7 h-7" />
              </div>
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-base sm:text-lg tracking-tight text-white leading-none">
                    Forens<span className="text-sky-400">IQ</span>
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-500/20 text-sky-300 border border-blue-400/30">
                    Field OS
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 font-normal tracking-wide mt-0.5 hidden xs:block">
                  Substance Analysis &amp; Digital Custody System
                </p>
              </div>
            </div>

            {/* Zone 2: Navigation Links on Desktop (Clean Segmented Tabs) */}
            <nav className="hidden md:flex items-center gap-1 p-1 bg-black/40 rounded-lg border border-white/10">
              <button
                onClick={() => setActiveTab('test')}
                className={`py-1.5 px-3.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
                  activeTab === 'test'
                    ? 'bg-white text-[#0a192f] shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <FlaskConical className="w-3.5 h-3.5" />
                <span>Chemical Test</span>
              </button>

              <button
                onClick={() => setActiveTab('log')}
                className={`py-1.5 px-3.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
                  activeTab === 'log'
                    ? 'bg-white text-[#0a192f] shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Evidence Ledger</span>
              </button>

              <button
                onClick={() => setActiveTab('sync')}
                className={`py-1.5 px-3.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
                  activeTab === 'sync'
                    ? 'bg-white text-[#0a192f] shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Gateway Sync</span>
              </button>

              <button
                onClick={() => setActiveTab('settings')}
                className={`py-1.5 px-3.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
                  activeTab === 'settings'
                    ? 'bg-white text-[#0a192f] shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Authority &amp; Keys</span>
              </button>
            </nav>

            {/* Zone 3: Officer Credentials & PWA Controls */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setActiveTab('sync')}
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-xs text-white transition cursor-pointer"
                title="Firebase Cloud Database Status"
              >
                <Cloud className="w-3.5 h-3.5 text-blue-300" />
                <span className="text-[11px] font-medium text-slate-200">Cloud DB</span>
              </button>

              <PWAInstallButton />

              {operator ? (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setActiveTab('settings')}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-xs text-white transition cursor-pointer text-left group"
                    title="Active sworn officer credentials"
                  >
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
                    </span>
                    <div className="leading-tight">
                      <div className="font-semibold text-white font-mono text-[11px] truncate max-w-[90px] sm:max-w-[110px]">
                        {operator.operatorId}
                      </div>
                      <div className="text-[10px] text-slate-300 font-medium truncate max-w-[90px] sm:max-w-[110px]">
                        {operator.badgeUnit}
                      </div>
                    </div>
                    <Shield className="w-3 h-3 text-slate-300 group-hover:text-amber-300 transition shrink-0" />
                  </button>

                  <button
                    onClick={handleLogout}
                    className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-red-500/20 hover:border-red-400/40 text-slate-200 hover:text-white border border-white/15 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                    title="Log out active officer session"
                  >
                    <LogOut className="w-3.5 h-3.5 text-slate-300" />
                    <span className="hidden sm:inline">Logout</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowSetupModal(true)}
                  className="px-3.5 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Enrol Officer</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Navigation Strip (Visible below md) */}
        <div className="md:hidden border-t border-white/10 px-4 py-2 overflow-x-auto bg-black/20">
          <nav className="flex items-center gap-1 min-w-max">
            <button
              onClick={() => setActiveTab('test')}
              className={`py-1.5 px-3 rounded-md text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
                activeTab === 'test'
                  ? 'bg-white text-[#0a1d37] shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              <FlaskConical className="w-3.5 h-3.5" />
              <span>Chemical Test</span>
            </button>

            <button
              onClick={() => setActiveTab('log')}
              className={`py-1.5 px-3 rounded-md text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
                activeTab === 'log'
                  ? 'bg-white text-[#0a1d37] shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Evidence Ledger</span>
            </button>

            <button
              onClick={() => setActiveTab('sync')}
              className={`py-1.5 px-3 rounded-md text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
                activeTab === 'sync'
                  ? 'bg-white text-[#0a1d37] shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Gateway Sync</span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`py-1.5 px-3 rounded-md text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
                activeTab === 'settings'
                  ? 'bg-white text-[#0a1d37] shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Authority &amp; Keys</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content Area - Full-Page Responsive Layout */}
      <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 xl:px-10 py-5 text-left space-y-6">
        {/* Officer Session Logged-Out Notice */}
        {!operator && !isLoading && (
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-800 shrink-0">
                <Shield className="w-5 h-5" />
              </div>
              <div className="text-left">
                <div className="text-xs font-bold text-amber-950">
                  Officer Session Inactive (Logged Out)
                </div>
                <div className="text-[11px] text-amber-800 mt-0.5">
                  An enrolled sworn officer identity is required to cryptographically sign and seal field test evidence.
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowSetupModal(true)}
              className="py-1.5 px-4 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs transition cursor-pointer shrink-0 shadow-xs flex items-center justify-center gap-1.5"
            >
              <User className="w-3.5 h-3.5" />
              <span>Enrol / Log In Officer</span>
            </button>
          </div>
        )}

        {/* Institutional Hero Banner on Chemical Test Tab */}
        {activeTab === 'test' && !isLoading && (
          <div className="bg-[#f4f6fa] border border-slate-300 rounded-xl p-5 sm:p-6 shadow-xs">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-2 max-w-3xl">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">
                  FORENSIC CHEMICAL SCREENING &bull; EXPEDITIONARY FIELD WORKSTATION
                </span>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-slate-900 leading-snug">
                  Presumptive Field Testing &amp; Cryptographic Custody
                </h1>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Automated colorimetric screening with NIST-traceable reference cards, sealed with hardware-bound ECDSA P-256 signatures.
                </p>

                <div className="flex flex-wrap items-center gap-2.5 pt-2">
                  <button
                    onClick={() => {
                      const el = document.getElementById('protocol-section');
                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="px-4 py-2 bg-[#0c2340] hover:bg-[#14325a] text-white rounded-md text-xs font-semibold shadow-xs transition cursor-pointer"
                  >
                    Start Chemical Test
                  </button>
                  <button
                    onClick={() => setActiveTab('log')}
                    className="px-4 py-2 bg-slate-200/80 hover:bg-slate-300 text-[#0c2340] border border-slate-300 rounded-md text-xs font-semibold transition cursor-pointer"
                  >
                    Evidence Ledger
                  </button>
                </div>
              </div>

              {/* Status / Metric strip on desktop */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-3 shrink-0">
                <div className="p-3.5 rounded-lg bg-[#e9edf2] border border-slate-300/80 text-left min-w-[120px]">
                  <span className="text-[10px] font-mono text-slate-500 block uppercase">Standard</span>
                  <div className="font-bold text-sm text-slate-900 mt-0.5">CIEDE2000</div>
                  <span className="text-[10px] text-slate-500 font-mono">ΔE₀₀ Metric</span>
                </div>
                <div className="p-3.5 rounded-lg bg-[#e9edf2] border border-slate-300/80 text-left min-w-[120px]">
                  <span className="text-[10px] font-mono text-slate-500 block uppercase">Security</span>
                  <div className="font-bold text-sm text-slate-900 mt-0.5">ECDSA P-256</div>
                  <span className="text-[10px] text-slate-500 font-mono">Hardware Key</span>
                </div>
                <div className="p-3.5 rounded-lg bg-[#e9edf2] border border-slate-300/80 text-left min-w-[120px]">
                  <span className="text-[10px] font-mono text-slate-500 block uppercase">Chain</span>
                  <div className="font-bold text-sm text-slate-900 mt-0.5">SHA-256</div>
                  <span className="text-[10px] text-slate-500 font-mono">Append-Only</span>
                </div>
                <div className="p-3.5 rounded-lg bg-[#e9edf2] border border-slate-300/80 text-left min-w-[120px]">
                  <span className="text-[10px] font-mono text-slate-500 block uppercase">Offline</span>
                  <div className="font-bold text-sm text-slate-900 mt-0.5">100% Local</div>
                  <span className="text-[10px] text-slate-500 font-mono">Zero Cloud Leak</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="py-20 text-center space-y-3 bg-[#f4f6fa] border border-slate-300 rounded-lg p-8">
            <div className="w-6 h-6 border-2 border-[#0c2340] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-slate-500 font-medium">
              Loading local custody database...
            </p>
          </div>
        ) : (
          <div id="protocol-section">
            {activeTab === 'test' && (
              <TestTab
                operator={operator}
                onNavigateToSettings={() => setActiveTab('settings')}
                onNavigateToLog={() => setActiveTab('log')}
              />
            )}

            {activeTab === 'log' && <LogTab />}

            {activeTab === 'sync' && <SyncTab operator={operator} />}

            {activeTab === 'settings' && (
              <SettingsTab
                operator={operator}
                storageStatus={storageStatus}
                onRefreshStorage={refreshStorage}
                onReEnroll={() => setShowSetupModal(true)}
                onLogout={handleLogout}
              />
            )}
          </div>
        )}
      </main>

      {/* Deep Navy Official Portal Footer - Full Width */}
      <footer className="bg-[#0a192f] border-t border-[#13325c] text-slate-300 mt-auto py-6">
        <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-left">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-400/20 flex items-center justify-center text-sky-400 shrink-0">
              <ForensIQLogo className="w-5 h-5" />
            </div>
            <div>
              <div className="font-semibold text-white text-xs flex items-center gap-1.5">
                <span>Forens<span className="text-sky-400">IQ</span></span>
                <span>&bull; Forensic Substance Intelligence</span>
              </div>
              <div className="text-[11px] text-slate-400">
                Cryptographic Chain-of-Custody &amp; Seizure Ledger Specification v1.0
              </div>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 text-center sm:text-right max-w-md">
            Presumptive colorimetric screening only. Formal judicial prosecution requires confirmatory laboratory analysis (GC/MS).
          </div>
        </div>
      </footer>

      {/* Offline Toast Banner */}
      <OfflineIndicator />

      {/* First-Run Operator & Key Generation Modal */}
      <OperatorSetupModal
        isOpen={showSetupModal}
        onComplete={handleSetupComplete}
        onClose={operator ? () => setShowSetupModal(false) : undefined}
      />

      {/* Officer Logout Confirmation Dialog */}
      <LogoutConfirmModal
        isOpen={showLogoutModal}
        operator={operator}
        onClose={() => setShowLogoutModal(false)}
        onConfirmLogout={handleConfirmLogout}
      />
    </div>
  );
}
