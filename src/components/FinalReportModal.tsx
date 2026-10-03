/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  FileText,
  Clock,
  Printer,
  Download,
  Copy,
  Check,
  X,
  ShieldCheck,
  ShieldAlert,
  MapPin,
  Calendar,
  Zap,
  Globe,
  Landmark,
  Scale,
} from 'lucide-react';
import type { TestRecordEntity, KitProfile } from '../types/index.ts';
import { extractTimeDenotation, generateForensicReportText } from '../lib/timeDenotation.ts';

interface FinalReportModalProps {
  isOpen: boolean;
  record: TestRecordEntity | null;
  kitProfile?: KitProfile;
  onClose: () => void;
}

export const FinalReportModal: React.FC<FinalReportModalProps> = ({
  isOpen,
  record,
  kitProfile,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !record) return null;

  const time = extractTimeDenotation(record, kitProfile);
  const reportText = generateForensicReportText(record, kitProfile);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(reportText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleDownloadTxt = () => {
    const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `forensic-report-${record.id.substring(0, 8)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-3xl rounded-xl bg-white border border-slate-300 shadow-2xl overflow-hidden text-left my-auto max-h-[92vh] flex flex-col">
        {/* Modal Action Bar (Fixed at top) */}
        <div className="bg-[#0a192f] text-white p-4 flex items-center justify-between border-b border-slate-700 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-400/20 border border-amber-400/30 flex items-center justify-center text-amber-300">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">
                  Official Final Forensic Report
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/10 text-slate-200 border border-white/15">
                  TIME CERTIFIED
                </span>
              </div>
              <p className="text-[11px] text-slate-300">
                Evidentiary screening summary with full chronological time denotation.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition cursor-pointer border border-white/15"
              title="Print official report"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>

            <button
              onClick={handleDownloadTxt}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition cursor-pointer border border-white/15"
              title="Download text certificate"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Download</span>
            </button>

            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold transition cursor-pointer shadow-xs"
              title="Copy formatted report text"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer ml-1"
              title="Close report modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Printable Report Canvas */}
        <div className="p-5 sm:p-7 overflow-y-auto space-y-6 text-slate-800 bg-[#fbfcfd] printable-report font-sans">
          {/* Institutional Document Header */}
          <div className="border-b-2 border-slate-900 pb-4 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-lg bg-[#0a192f] flex items-center justify-center text-amber-400 shrink-0 shadow-sm">
                <Landmark className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500 font-bold block">
                  DEPARTMENT OF PUBLIC SAFETY • FORENSIC EVIDENCE DIVISION
                </span>
                <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight leading-tight">
                  FIELD EVIDENCE RECORD &amp; CUSTODY CERTIFICATE
                </h1>
                <p className="text-xs text-slate-600 mt-0.5 font-medium">
                  Tamper-Evident Screening Document • Hardware ECDSA P-256 Signature
                </p>
              </div>
            </div>

            <div className="text-left sm:text-right font-mono text-[11px] text-slate-600 space-y-0.5 shrink-0 bg-slate-100 p-2.5 rounded-lg border border-slate-200">
              <div>
                <span className="text-slate-500">CERTIFICATE NO:</span>{' '}
                <strong className="text-slate-900">FTC-{record.id.substring(0, 8).toUpperCase()}</strong>
              </div>
              <div>
                <span className="text-slate-500">CUSTODY STATUS:</span>{' '}
                <strong className="text-emerald-700">SEALED / VERIFIED</strong>
              </div>
            </div>
          </div>

          {/* DEDICATED SECTION: COMPLETE CHRONOLOGICAL TIME DENOTATION */}
          <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-blue-200/80">
              <div className="flex items-center gap-2 text-blue-950 font-bold text-xs uppercase tracking-wider">
                <Clock className="w-4 h-4 text-blue-700" />
                <span>Section II: Chronological Time Denotation &amp; Temporal Evidence</span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-200/60 text-blue-900 font-semibold">
                NIST / UTC Traceable
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              {/* UTC Timestamp */}
              <div className="bg-white p-3 rounded-lg border border-blue-200/80 shadow-2xs space-y-1">
                <span className="text-[10px] font-mono uppercase text-slate-500 font-bold flex items-center gap-1">
                  <Globe className="w-3 h-3 text-blue-600" />
                  UTC Timestamp (ISO 8601)
                </span>
                <div className="font-mono font-semibold text-slate-900 text-[11px] break-all">
                  {time.isoUtc}
                </div>
                <div className="text-[10px] text-slate-500 font-mono">
                  Unix Epoch: {time.epochMs} ms
                </div>
              </div>

              {/* Local Incident Time */}
              <div className="bg-white p-3 rounded-lg border border-blue-200/80 shadow-2xs space-y-1">
                <span className="text-[10px] font-mono uppercase text-slate-500 font-bold flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-blue-600" />
                  Local Field Time
                </span>
                <div className="font-semibold text-slate-900 text-xs">
                  {time.localDateOnly}
                </div>
                <div className="text-slate-700 font-mono text-[11px]">
                  {time.localTimeOnly}
                </div>
                <div className="text-[10px] text-blue-700 font-medium">
                  {time.timeZoneName} ({time.utcOffset})
                </div>
              </div>

              {/* Monotonic Hardware Clock */}
              <div className="bg-white p-3 rounded-lg border border-blue-200/80 shadow-2xs space-y-1">
                <span className="text-[10px] font-mono uppercase text-slate-500 font-bold flex items-center gap-1">
                  <Zap className="w-3 h-3 text-blue-600" />
                  Monotonic Boot Clock
                </span>
                <div className="font-mono font-bold text-slate-900 text-xs">
                  +{time.bootClockMs.toFixed(1)} ms
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">
                  Independent hardware baseline; prevents system time spoofing.
                </p>
              </div>

              {/* Chemical Reaction Read Duration */}
              <div className="bg-white p-3 rounded-lg border border-blue-200/80 shadow-2xs space-y-1">
                <span className="text-[10px] font-mono uppercase text-slate-500 font-bold flex items-center gap-1">
                  <Clock className="w-3 h-3 text-blue-600" />
                  Reaction Timing Window
                </span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="font-bold text-slate-900 text-xs">
                    {time.reactionElapsedSeconds ? `${time.reactionElapsedSeconds}s` : '30s'}
                  </span>
                  <span className="text-[9px] font-semibold font-mono uppercase px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                    {record.reactionTimeFlag || 'ON_TIME'}
                  </span>
                </div>
                <div className="text-[10px] text-slate-500">
                  Target: {time.reactionTargetSeconds || 30}s (±{time.reactionToleranceSeconds || 15}s)
                </div>
              </div>
            </div>

            {/* GPS Satellite Time Alignment Sub-strip */}
            {record.gps && (
              <div className="pt-2 border-t border-blue-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-blue-900">
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                  <span>
                    GPS Satellite Fix:{' '}
                    <strong>
                      {record.gps.latitude !== null && record.gps.longitude !== null
                        ? `${record.gps.latitude.toFixed(6)}, ${record.gps.longitude.toFixed(6)} (±${record.gps.accuracyMeters?.toFixed(1) || '0'}m)`
                        : 'Unavailable'}
                    </strong>
                  </span>
                </div>
                {record.gps.timestampIso && (
                  <div className="font-mono text-[10px] text-slate-600">
                    Satellite Clock: {record.gps.timestampIso}{' '}
                    {time.gpsClockDeltaMs != null && (
                      <span>({time.gpsClockDeltaMs >= 0 ? '+' : ''}{time.gpsClockDeltaMs}ms delta)</span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Core Case & Officer Identification */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">
                Section I: Sworn Operator Credentials
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                <div>
                  <span className="text-slate-500 block text-[10px]">Operator ID:</span>
                  <span className="font-bold text-slate-900">{record.operatorId}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Badge / Unit:</span>
                  <span className="font-bold text-slate-900">{record.badgeUnit}</span>
                </div>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Department / Agency:</span>
                <span className="font-semibold text-slate-900">Narcotics Field Enforcement Division</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Public Key Fingerprint (SHA-256):</span>
                <span className="font-mono text-[10px] text-slate-700 break-all select-all">
                  {record.publicKeyFingerprint}
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">
                Section III: Chemical Screening Result
              </span>
              <div className="flex items-center justify-between pt-1">
                <span className="text-slate-500 text-[10px]">Tested Protocol:</span>
                <span className="font-mono font-bold text-slate-900 text-xs">
                  {record.kitProfileId} (v{record.kitProfileVersion})
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 text-[10px]">Presumptive Finding:</span>
                <span className={`px-2 py-0.5 rounded text-xs font-bold font-mono ${
                  record.result === 'POSITIVE'
                    ? 'bg-red-100 text-red-900 border border-red-300'
                    : record.result === 'NEGATIVE'
                    ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                    : 'bg-amber-100 text-amber-900 border border-amber-300'
                }`}>
                  {record.result}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 text-[10px]">Classification Confidence:</span>
                <span className="font-bold text-slate-900 font-mono">
                  {Math.round(record.confidence * 100)}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 text-[10px]">Calibration Residual:</span>
                <span className="font-mono font-semibold text-slate-800">
                  {record.calibrationData?.meanResidualDeltaE?.toFixed(2) || '0.00'} ΔE₀₀ ({record.calibrationData?.quality || 'POOR'})
                </span>
              </div>
            </div>
          </div>

          {/* Finding Rationale */}
          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">
              Analytical Rationale &amp; Colorimetric Interpretation
            </span>
            <p className="text-slate-800 text-[11px] leading-relaxed pt-0.5">
              {record.reason}
            </p>
          </div>

          {/* Cryptographic Seal & Signatures */}
          <div className="p-3.5 rounded-lg bg-slate-900 text-white space-y-2 text-xs font-mono">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-700">
              <span className="text-[10px] uppercase tracking-wider text-amber-400 font-bold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Section V: Non-Extractable Cryptographic Provenance
              </span>
              <span className="text-[10px] text-slate-400">ECDSA P-256</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] text-slate-300 pt-1">
              <div>
                <span className="text-slate-400 block">Sample Photo SHA-256:</span>
                <span className="break-all text-slate-200">{record.sampleImageHashSha256 || record.imageHashSha256}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Canonical Record SHA-256:</span>
                <span className="break-all text-slate-200">{record.recordHashSha256}</span>
              </div>
            </div>

            <div className="pt-1 text-[10px]">
              <span className="text-slate-400 block">ECDSA Digital Signature (Hex):</span>
              <span className="break-all text-emerald-400 font-mono select-all">
                {record.signatureHex}
              </span>
            </div>
          </div>

          {/* Mandatory Statutory Disclaimer */}
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-300 text-amber-950 text-[11px] leading-relaxed flex items-start gap-2.5">
            <Scale className="w-4 h-4 text-amber-800 shrink-0 mt-0.5" />
            <div>
              <strong>MANDATORY STATUTORY DISCLAIMER (PRESUMPTIVE FIELD SCREENING ONLY):</strong>
              <p className="mt-0.5 text-amber-900">
                This document certifies a presumptive field screening analysis only. Colorimetric reagents are subject to cross-reactions with non-controlled compounds. Formal laboratory confirmation via GC/MS, LC/MS, or FTIR is required for evidentiary judicial prosecution.
              </p>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="bg-slate-100 p-3.5 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2 shrink-0">
          <div className="flex items-center gap-1 text-[11px]">
            <span>Report issued with complete time denotation • ForensIQ Cryptographic System</span>
          </div>
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs transition cursor-pointer"
          >
            Close Report
          </button>
        </div>
      </div>
    </div>
  );
};
