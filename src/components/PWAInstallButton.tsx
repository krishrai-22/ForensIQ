/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall.ts';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If running as standalone app, suppress prompt
  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/10 hover:bg-white/20 border border-white/15 text-white text-xs font-medium rounded-md transition cursor-pointer"
        title="Install ForensIQ as a standalone PWA"
      >
        <Download className="w-3.5 h-3.5 text-slate-300" />
        <span>Install</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/10 hover:bg-white/20 border border-white/15 text-white text-xs font-medium rounded-md transition cursor-pointer"
        >
          <Smartphone className="w-3.5 h-3.5 text-slate-300" />
          <span>Install</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
            <div className="w-full max-w-sm rounded-md bg-white border border-slate-200 p-5 shadow-xl text-left">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-slate-700" />
                  Install on iOS Safari
                </h3>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 rounded text-slate-400 hover:text-slate-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="mt-3.5 space-y-2.5 text-xs text-slate-600">
                <div className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-4 h-4 rounded bg-slate-100 text-slate-800 font-semibold flex items-center justify-center text-[10px] border border-slate-200">
                    1
                  </span>
                  <span>Tap the <strong>Share</strong> button (box with upward arrow) in the Safari toolbar.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-4 h-4 rounded bg-slate-100 text-slate-800 font-semibold flex items-center justify-center text-[10px] border border-slate-200">
                    2
                  </span>
                  <span>Scroll down the action sheet and select <strong>Add to Home Screen</strong>.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-4 h-4 rounded bg-slate-100 text-slate-800 font-semibold flex items-center justify-center text-[10px] border border-slate-200">
                    3
                  </span>
                  <span>Launch from your home screen for full offline-first field test operation.</span>
                </div>
              </div>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-4 w-full rounded-md bg-slate-900 hover:bg-slate-800 py-2 text-xs font-medium text-white transition"
              >
                Understood
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
