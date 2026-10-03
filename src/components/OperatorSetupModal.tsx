/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Shield, Key, CheckCircle2, User, Hash, Building2, Loader2, Copy, Check, X } from 'lucide-react';
import { initializeOperatorProfile } from '../db/index.ts';
import type { OperatorProfile } from '../types/index.ts';
import { ForensIQLogo } from './ForensIQLogo.tsx';

interface OperatorSetupModalProps {
  isOpen: boolean;
  onComplete: (profile: OperatorProfile) => void;
  onClose?: () => void;
}

export const OperatorSetupModal: React.FC<OperatorSetupModalProps> = ({ isOpen, onComplete, onClose }) => {
  const [operatorId, setOperatorId] = useState('');
  const [badgeUnit, setBadgeUnit] = useState('');
  const [department, setDepartment] = useState('Narcotics Field Enforcement');
  const [isGenerating, setIsGenerating] = useState(false);
  const [setupStep, setSetupStep] = useState<'form' | 'generating' | 'success'>('form');
  const [createdProfile, setCreatedProfile] = useState<OperatorProfile | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!operatorId.trim()) {
      setErrorMessage('Operator ID is required (e.g. Officer ID or Call Sign).');
      return;
    }
    if (!badgeUnit.trim()) {
      setErrorMessage('Badge / Patrol Unit is required (e.g. B-409 / K9-02).');
      return;
    }

    setErrorMessage(null);
    setIsGenerating(true);
    setSetupStep('generating');

    try {
      // Simulate minor step cadence so officer sees cryptographic assurance
      const { profile } = await initializeOperatorProfile(operatorId, badgeUnit, department);
      setCreatedProfile(profile);
      setSetupStep('success');
    } catch (err) {
      console.error('Failed to initialize operator credentials:', err);
      setErrorMessage(
        err instanceof Error ? err.message : 'Cryptographic key generation failed. Check WebCrypto support in this browser.'
      );
      setSetupStep('form');
    } finally {
      setIsGenerating(false);
    }
  };

  const copyFingerprint = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-md bg-white border border-slate-200 shadow-xl p-6 sm:p-7 text-left">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-[#0a192f] border border-blue-500/30 flex items-center justify-center flex-shrink-0 shadow-inner">
              <ForensIQLogo className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                <span>Forens<span className="text-sky-600">IQ</span></span>
                <span className="text-xs font-semibold text-slate-500">Officer Setup</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                First-run enrollment & non-extractable device cryptographic key generation.
              </p>
            </div>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {setupStep === 'form' && (
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            {errorMessage && (
              <div className="p-3 rounded-md bg-slate-100 border border-slate-400 text-xs text-slate-800">
                <strong>Error:</strong> {errorMessage}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 uppercase tracking-wider">
                <User className="w-3.5 h-3.5 text-slate-500" />
                Operator ID / Name *
              </label>
              <input
                type="text"
                required
                value={operatorId}
                onChange={(e) => setOperatorId(e.target.value)}
                placeholder="e.g. Officer J. Miller (ID #8821)"
                className="w-full px-3 py-2 rounded-md bg-white border border-slate-300 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-800"
              />
              <p className="text-[11px] text-slate-500">
                Appears on all signed evidence logs and chain of custody documentation.
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 uppercase tracking-wider">
                <Hash className="w-3.5 h-3.5 text-slate-500" />
                Badge & Unit / Assignment *
              </label>
              <input
                type="text"
                required
                value={badgeUnit}
                onChange={(e) => setBadgeUnit(e.target.value)}
                placeholder="e.g. Badge 1420 / Rapid Response Unit 4"
                className="w-full px-3 py-2 rounded-md bg-white border border-slate-300 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-800"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 uppercase tracking-wider">
                <Building2 className="w-3.5 h-3.5 text-slate-500" />
                Department / Agency
              </label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="e.g. Metro Police Narcotics Division"
                className="w-full px-3 py-2 rounded-md bg-white border border-slate-300 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-800"
              />
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-md p-3 text-xs text-slate-600 space-y-1">
              <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-slate-700" />
                Cryptographic Hardware-Equivalent Security
              </div>
              <p className="text-slate-500 leading-relaxed text-[11px]">
                Upon confirmation, this device will generate an <strong>ECDSA P-256</strong> keypair using browser WebCrypto.
                The private signing key is flagged <code>extractable: false</code> and securely isolated in local IndexedDB. It can never be exported or read by external scripts.
              </p>
            </div>

            <div className="mt-2 flex items-center gap-2">
              <button
                type="submit"
                disabled={isGenerating}
                className="flex-1 py-2.5 px-4 rounded-md bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs flex items-center justify-center gap-2 cursor-pointer transition disabled:opacity-50"
              >
                <Key className="w-3.5 h-3.5" />
                <span>Generate Keys & Initialize Companion</span>
              </button>
              {onClose && (
                <button
                  type="button"
                  disabled={isGenerating}
                  onClick={onClose}
                  className="py-2.5 px-4 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs border border-slate-300 transition cursor-pointer"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        )}

        {setupStep === 'generating' && (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
            <Loader2 className="w-8 h-8 text-slate-800 animate-spin" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">Generating ECDSA P-256 Keypair</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-xs">
                Generating non-extractable private key and calculating SHA-256 public key fingerprint...
              </p>
            </div>
          </div>
        )}

        {setupStep === 'success' && createdProfile && (
          <div className="mt-5 space-y-4">
            <div className="p-3.5 rounded-md bg-slate-50 border border-slate-200 flex items-start gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-slate-800 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-xs font-bold text-slate-900">
                  Cryptographic Setup Successful
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Private signing key generated and committed to non-extractable IndexedDB storage.
                </p>
              </div>
            </div>

            <div className="space-y-2 bg-slate-50 rounded-md p-3.5 border border-slate-200 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Operator:</span>
                <span className="font-semibold text-slate-900">{createdProfile.operatorId}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Badge & Unit:</span>
                <span className="font-semibold text-slate-900">{createdProfile.badgeUnit}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Department:</span>
                <span className="font-semibold text-slate-900">{createdProfile.department}</span>
              </div>

              <div className="pt-2 border-t border-slate-200 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">Public Key Fingerprint (SHA-256):</span>
                  <button
                    onClick={() => copyFingerprint(createdProfile.keyFingerprint)}
                    className="flex items-center gap-1 text-[11px] text-slate-600 hover:text-slate-900 cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-slate-900" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <div className="p-2 rounded bg-white font-mono text-[11px] text-slate-800 break-all border border-slate-200 select-all leading-relaxed">
                  {createdProfile.keyFingerprint}
                </div>
              </div>
            </div>

            <button
              onClick={() => onComplete(createdProfile)}
              className="w-full py-2.5 px-4 rounded-md bg-[#0a192f] hover:bg-[#132847] text-white font-medium text-xs flex items-center justify-center gap-2 cursor-pointer transition shadow-xs"
            >
              <Check className="w-3.5 h-3.5" />
              Begin Using ForensIQ
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
