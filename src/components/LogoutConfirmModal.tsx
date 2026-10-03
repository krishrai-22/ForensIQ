/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { LogOut, ShieldAlert, CheckCircle2, User, Hash, Building2, Loader2, KeyRound, UserPlus } from 'lucide-react';
import type { OperatorProfile } from '../types/index.ts';

interface LogoutConfirmModalProps {
  isOpen: boolean;
  operator: OperatorProfile | null;
  onClose: () => void;
  onConfirmLogout: (andReEnroll?: boolean) => Promise<void>;
}

export const LogoutConfirmModal: React.FC<LogoutConfirmModalProps> = ({
  isOpen,
  operator,
  onClose,
  onConfirmLogout,
}) => {
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  if (!isOpen) return null;

  const handleLogout = async (andReEnroll = false) => {
    setIsLoggingOut(true);
    try {
      await onConfirmLogout(andReEnroll);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="logout-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 overflow-y-auto animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoggingOut) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-xl bg-white border border-slate-300 shadow-2xl overflow-hidden text-left">
        {/* Header Strip */}
        <div className="bg-[#0a192f] p-5 text-white flex items-start gap-3.5 border-b border-slate-700">
          <div className="w-10 h-10 rounded-lg bg-red-500/20 border border-red-400/40 flex items-center justify-center text-red-400 shrink-0">
            <LogOut className="w-5 h-5" />
          </div>
          <div>
            <h2 id="logout-modal-title" className="text-base font-bold text-white tracking-tight">
              Log Out Officer Session
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Confirm departure from active terminal session.
            </p>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Active Operator Credentials Card */}
          {operator && (
            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                <span>Active Credentials To Be Cleared</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                <div className="bg-white p-2 rounded border border-slate-200">
                  <div className="text-[10px] text-slate-500 flex items-center gap-1">
                    <User className="w-3 h-3 text-slate-400" /> Operator ID
                  </div>
                  <div className="font-semibold text-slate-900 truncate mt-0.5">
                    {operator.operatorId}
                  </div>
                </div>
                <div className="bg-white p-2 rounded border border-slate-200">
                  <div className="text-[10px] text-slate-500 flex items-center gap-1">
                    <Hash className="w-3 h-3 text-slate-400" /> Badge / Unit
                  </div>
                  <div className="font-semibold text-slate-900 truncate mt-0.5">
                    {operator.badgeUnit}
                  </div>
                </div>
              </div>
              {operator.department && (
                <div className="text-[11px] text-slate-600 flex items-center gap-1.5 px-1">
                  <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{operator.department}</span>
                </div>
              )}
            </div>
          )}

          {/* Evidence Preservation Assurance */}
          <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 flex items-start gap-2.5 text-xs text-emerald-900">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5 leading-relaxed">
              <span className="font-semibold block text-emerald-950">
                Evidence Ledger Fully Preserved
              </span>
              <p className="text-emerald-800 text-[11px]">
                All previously signed test records, tamper-evident chains of custody, and cryptographic audit logs remain safely intact in local database storage.
              </p>
            </div>
          </div>

          <div className="text-xs text-slate-500 leading-relaxed">
            Logging out clears active non-extractable session keys from memory. To sign future colorimetric test records, an officer must re-enrol or enrol fresh credentials.
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isLoggingOut}
                onClick={() => handleLogout(false)}
                className="flex-1 py-2.5 px-4 rounded-lg bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-semibold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-sm disabled:opacity-50"
              >
                {isLoggingOut ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <LogOut className="w-4 h-4" />
                )}
                <span>Log Out Session</span>
              </button>

              <button
                type="button"
                disabled={isLoggingOut}
                onClick={onClose}
                className="py-2.5 px-4 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs transition cursor-pointer disabled:opacity-50 border border-slate-300"
              >
                Cancel
              </button>
            </div>

            <button
              type="button"
              disabled={isLoggingOut}
              onClick={() => handleLogout(true)}
              className="w-full py-2 px-3 rounded-lg bg-slate-100 hover:bg-amber-50 hover:border-amber-300 hover:text-amber-900 text-slate-700 font-medium text-xs flex items-center justify-center gap-2 transition cursor-pointer border border-slate-200 disabled:opacity-50"
              title="Log out and immediately open enrollment for the next shift officer"
            >
              <UserPlus className="w-3.5 h-3.5 text-slate-500" />
              <span>Log Out &amp; Enrol New Shift Officer</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
