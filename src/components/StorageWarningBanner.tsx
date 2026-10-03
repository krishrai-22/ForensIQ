/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AlertTriangle, HardDrive, Download, X, HelpCircle, CheckCircle2 } from 'lucide-react';
import { type StoragePersistenceStatus, checkAndRequestStoragePersistence } from '../lib/storage.ts';
import { usePWAInstall } from '../hooks/usePWAInstall.ts';

const DISMISSAL_STORAGE_KEY = 'forensiq_storage_warning_dismissed';

interface StorageWarningBannerProps {
  status: StoragePersistenceStatus | null;
  onRefresh: () => Promise<void>;
}

export const StorageWarningBanner: React.FC<StorageWarningBannerProps> = ({ status, onRefresh }) => {
  const [isDismissed, setIsDismissed] = useState(true); // default true until checked
  const [isRequesting, setIsRequesting] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [deniedMessage, setDeniedMessage] = useState<string | null>(null);
  const { isInstallable, install, isInstalled } = usePWAInstall();

  useEffect(() => {
    try {
      const saved = localStorage.getItem(DISMISSAL_STORAGE_KEY);
      setIsDismissed(saved === 'true');
    } catch {
      setIsDismissed(false);
    }
  }, []);

  // If already persisted, or app is installed (which auto-protects storage), or dismissed
  if (!status || status.isPersisted || isInstalled || isDismissed) {
    return null;
  }

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      localStorage.setItem(DISMISSAL_STORAGE_KEY, 'true');
    } catch {
      // ignore
    }
  };

  const handleRequest = async () => {
    setIsRequesting(true);
    setDeniedMessage(null);
    try {
      const res = await checkAndRequestStoragePersistence();
      await onRefresh();
      if (!res.isPersisted) {
        // Mobile Chrome / Safari does not show a permission popup for storage.
        // It requires installing the PWA or adding to home screen to elevate storage status.
        setDeniedMessage(
          'Mobile Chrome requires installing the app to grant permanent storage tier.'
        );
      }
    } catch {
      setDeniedMessage('Could not request storage persistence from browser.');
    } finally {
      setIsRequesting(false);
    }
  };

  const handleInstallClick = async () => {
    if (isInstallable) {
      await install();
    } else {
      setShowDetailModal(true);
    }
  };

  return (
    <>
      <div className="bg-amber-50 border-b border-amber-200 text-slate-800 px-4 py-2.5 text-xs transition-all">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-slate-900 leading-tight">
                  Notice: Browser Storage Not Guaranteed Permanent
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-200/80 text-amber-900">
                  Temporary Mode
                </span>
              </div>
              <p className="text-slate-600 text-[11px] mt-0.5">
                {deniedMessage ? (
                  <span className="text-amber-900 font-medium">
                    {deniedMessage}{' '}
                    <span className="underline cursor-pointer" onClick={() => setShowDetailModal(true)}>
                      See how to install
                    </span>
                  </span>
                ) : (
                  'Android may clear uninstalled browser cache and ECDSA keys if device disk space is critical.'
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center shrink-0 flex-wrap">
            {deniedMessage || isInstallable ? (
              <button
                onClick={handleInstallClick}
                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded transition flex items-center gap-1 cursor-pointer shadow-xs"
              >
                <Download className="w-3 h-3" />
                <span>Install App</span>
              </button>
            ) : (
              <button
                onClick={handleRequest}
                disabled={isRequesting}
                className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs rounded transition flex items-center gap-1 cursor-pointer disabled:opacity-50 shadow-xs"
              >
                <HardDrive className="w-3 h-3" />
                <span>{isRequesting ? 'Requesting...' : 'Request Persistence'}</span>
              </button>
            )}

            <button
              onClick={() => setShowDetailModal(true)}
              className="px-2 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded text-xs transition cursor-pointer flex items-center gap-1"
            >
              <HelpCircle className="w-3 h-3 text-slate-500" />
              <span>How to fix</span>
            </button>

            <button
              onClick={handleDismiss}
              className="px-2 py-1 bg-white/60 hover:bg-white text-slate-600 hover:text-slate-900 border border-slate-200 rounded text-xs transition cursor-pointer"
              title="Dismiss warning permanently"
            >
              Dismiss
            </button>

            <button
              onClick={handleDismiss}
              className="p-1 text-slate-400 hover:text-slate-700 rounded transition cursor-pointer"
              title="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {showDetailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-lg bg-white border border-slate-200 p-5 shadow-2xl text-left">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Ensuring Permanent Field Storage
              </h3>
              <button
                onClick={() => setShowDetailModal(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-3.5 space-y-3 text-xs text-slate-600">
              <p>
                Mobile browsers (Chrome, Edge, Safari) protect phone storage by automatically purging temporary website caches and databases when your phone is low on disk space.
              </p>

              <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-blue-900 space-y-2">
                <div className="font-semibold flex items-center gap-1.5 text-blue-950">
                  <CheckCircle2 className="w-4 h-4 text-blue-600" />
                  Why "Request Persistence" was refused by Chrome:
                </div>
                <p className="text-[11px] text-blue-800 leading-relaxed">
                  Google Chrome on Android does not show a permission dialog for storage. Instead, Chrome strictly requires the web app to be <strong>Installed to Home Screen</strong> or <strong>Bookmarked</strong> before it grants permanent storage.
                </p>
              </div>
              
              <div className="bg-slate-50 rounded-md p-3 border border-slate-200 space-y-2.5 text-slate-700">
                <div className="font-semibold text-slate-900">How to Fix in 2 Steps:</div>
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">1</div>
                  <span>
                    Tap <strong>Chrome Menu (⋮)</strong> in the top right corner of your phone browser.
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">2</div>
                  <span>
                    Select <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>.
                  </span>
                </div>
              </div>

              {status.quotaBytes !== undefined && (
                <div className="text-[11px] text-slate-500 pt-1">
                  Current storage status: {(status.quotaBytes / (1024 * 1024)).toFixed(1)} MB quota (approx. {((status.usageBytes || 0) / (1024 * 1024)).toFixed(2)} MB used).
                </div>
              )}
            </div>

            <div className="mt-4 flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
              <button
                onClick={handleDismiss}
                className="px-3 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium cursor-pointer"
              >
                Dismiss Notice
              </button>
              {isInstallable && (
                <button
                  onClick={async () => {
                    setShowDetailModal(false);
                    await install();
                  }}
                  className="px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium cursor-pointer"
                >
                  Install Now
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
