/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  AlertTriangle,
  Lock,
  FileText,
  MapPin,
  Clock,
  Key,
  Flame,
  ArrowRight,
  X,
  RefreshCw,
} from 'lucide-react';
import type { TestRecordEntity } from '../types/index.ts';
import {
  verifyTestRecord,
  simulateRecordTampering,
  type VerificationReport,
} from '../lib/recordSigning.ts';
import { extractTimeDenotation } from '../lib/timeDenotation.ts';
import { FinalReportModal } from './FinalReportModal.tsx';
import { db } from '../db/index.ts';

interface SignedRecordModalProps {
  isOpen: boolean;
  record: TestRecordEntity | null;
  onClose: () => void;
  onNavigateToLog?: () => void;
}

export const SignedRecordModal: React.FC<SignedRecordModalProps> = ({
  isOpen,
  record: initialRecord,
  onClose,
  onNavigateToLog,
}) => {
  const [currentRecord, setCurrentRecord] = useState<TestRecordEntity | null>(initialRecord);
  const [verificationReport, setVerificationReport] = useState<VerificationReport | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isTampering, setIsTampering] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showTamperMenu, setShowTamperMenu] = useState(false);
  const [showFinalReport, setShowFinalReport] = useState(false);

  useEffect(() => {
    setCurrentRecord(initialRecord);
  }, [initialRecord]);

  // Run verification whenever record changes
  const runVerification = async (rec: TestRecordEntity) => {
    setIsVerifying(true);
    try {
      // Find predecessor record for chain verification
      let prevRec: TestRecordEntity | null = null;
      if (rec.prevRecordHash !== 'GENESIS') {
        const records = await db.testRecords.orderBy('timestampIso').toArray();
        const curIdx = records.findIndex((r) => r.id === rec.id);
        if (curIdx > 0) {
          prevRec = records[curIdx - 1];
        }
      }

      const report = await verifyTestRecord(rec, rec.imageBlob, prevRec);
      setVerificationReport(report);
    } catch (err) {
      console.error('Verification error:', err);
    } finally {
      setIsVerifying(false);
    }
  };

  useEffect(() => {
    if (currentRecord) {
      runVerification(currentRecord);
    }
  }, [currentRecord]);

  if (!isOpen || !currentRecord) return null;

  const copyText = async (text: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      // ignore
    }
  };

  const handleSimulateTamper = async (
    mode: 'tamper_result' | 'tamper_confidence' | 'tamper_image' | 'tamper_chain'
  ) => {
    setIsTampering(true);
    setShowTamperMenu(false);
    try {
      const tampered = await simulateRecordTampering(currentRecord.id, mode);
      setCurrentRecord(tampered);
    } catch (err) {
      alert('Tampering simulation failed: ' + String(err));
    } finally {
      setIsTampering(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-md bg-white border border-slate-200 p-5 shadow-xl text-left space-y-4 my-auto">
        {/* Certificate Header */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0 bg-slate-100 border border-slate-200 text-slate-800">
              {verificationReport?.overallPass ? (
                <ShieldCheck className="w-5 h-5 text-slate-800" />
              ) : (
                <ShieldAlert className="w-5 h-5 text-slate-800" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-slate-900">
                  Signed Evidentiary Record
                </h2>
                <span className="text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-mono">
                  ECDSA P-256
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Record UUID: <code className="text-slate-700 font-mono">{currentRecord.id}</code>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tamper Warning Banner if detected */}
        {verificationReport?.tamperDetected && (
          <div className="p-3 rounded-md bg-slate-100 border border-slate-300 text-slate-900 text-xs space-y-1">
            <div className="flex items-center gap-2 font-semibold text-slate-900 text-xs">
              <AlertTriangle className="w-4 h-4 text-slate-700" />
              <span>TAMPER DETECTION ALERT · SIGNATURE INVALIDATED</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Cryptographic verification failed. The record payload, image bytes, or chain link do not match the officer&apos;s ECDSA signature.
            </p>
          </div>
        )}

        {/* Primary Snapshot */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div className="p-2.5 rounded-md bg-slate-50 border border-slate-200">
            <span className="text-[10px] font-semibold uppercase text-slate-500">Outcome</span>
            <div className="font-semibold text-xs mt-0.5 text-slate-900">
              {currentRecord.result}
            </div>
          </div>

          <div className="p-2.5 rounded-md bg-slate-50 border border-slate-200">
            <span className="text-[10px] font-semibold uppercase text-slate-500">Confidence</span>
            <div className="font-semibold text-xs text-slate-900 mt-0.5">
              {Math.round(currentRecord.confidence * 100)}%
            </div>
          </div>

          <div className="p-2.5 rounded-md bg-slate-50 border border-slate-200">
            <span className="text-[10px] font-semibold uppercase text-slate-500">Officer / Unit</span>
            <div className="font-semibold text-xs text-slate-900 mt-0.5 truncate">
              {currentRecord.operatorId}
            </div>
          </div>

          <div className="p-2.5 rounded-md bg-slate-50 border border-slate-200">
            <span className="text-[10px] font-semibold uppercase text-slate-500">Chain Link</span>
            <div className="font-mono text-xs text-slate-700 mt-0.5 truncate">
              {currentRecord.prevRecordHash === 'GENESIS' ? 'Genesis #1' : `${currentRecord.prevRecordHash.substring(0, 8)}...`}
            </div>
          </div>
        </div>

        {/* Certified Chronological Time Denotation */}
        <div className="p-3 rounded-lg bg-blue-50/70 border border-blue-200/80 text-xs text-blue-950 space-y-1.5">
          <div className="flex items-center justify-between font-bold text-[11px] pb-1 border-b border-blue-200/60">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-blue-700" />
              <span>Certified Chronological Time Denotation</span>
            </span>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-blue-200/60 text-blue-900 font-semibold">
              UTC &amp; Local Certified
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] pt-0.5">
            <div>
              <span className="text-slate-500 block text-[10px]">Local Field Time:</span>
              <span className="font-semibold text-slate-900">
                {extractTimeDenotation(currentRecord).localFormatted}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">UTC Timestamp (ISO):</span>
              <span className="font-mono text-[10px] text-slate-800 break-all">
                {currentRecord.timestampIso}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">Reaction &amp; Hardware Clock:</span>
              <span className="font-mono text-[10px] text-slate-800 font-medium flex items-center gap-1">
                {currentRecord.reactionElapsedSeconds ? `${currentRecord.reactionElapsedSeconds}s` : '30s'} ({currentRecord.reactionTimeFlag || 'ON_TIME'}) • +{currentRecord.bootClockMs.toFixed(1)}ms
              </span>
            </div>
          </div>
        </div>

        {/* Real-Time Verification Report (The 4 Per-Check Tests) */}
        <div className="space-y-2 bg-slate-50 p-3 rounded-md border border-slate-200">
          <div className="flex items-center justify-between pb-1 border-b border-slate-200">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-slate-700" />
              <span className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                Integrity Audit (4 Checks)
              </span>
            </div>
            {isVerifying ? (
              <span className="text-[10px] text-slate-400">Verifying...</span>
            ) : verificationReport?.overallPass ? (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                4 / 4 PASSED
              </span>
            ) : (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-200 text-slate-900 border border-slate-300">
                FAILED
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-1.5 pt-1">
            {verificationReport?.checks.map((chk, idx) => (
              <div
                key={idx}
                className="p-2 rounded border border-slate-200 bg-white text-xs flex items-start justify-between gap-2"
              >
                <div className="flex items-start gap-2">
                  {chk.passed ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-slate-700 flex-shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-slate-700 flex-shrink-0 mt-0.5" />
                  )}
                  <div>
                    <span className="font-medium text-slate-900 block text-xs">{chk.name}</span>
                    <p className="text-[10px] text-slate-500 mt-0.5">{chk.message}</p>
                  </div>
                </div>

                <span
                  className="text-[9px] font-semibold uppercase font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 flex-shrink-0"
                >
                  {chk.passed ? 'PASS' : 'FAIL'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Cryptographic Digests */}
        <div className="space-y-1.5 text-xs">
          <div className="p-2.5 rounded-md bg-slate-50 border border-slate-200 space-y-1 font-mono text-[10px]">
            <div className="flex items-center justify-between text-slate-500">
              <span>Record Digest (SHA-256):</span>
              <button
                onClick={() => copyText(currentRecord.recordHashSha256, 'recordHash')}
                className="text-slate-700 hover:text-slate-900 flex items-center gap-1 cursor-pointer font-sans text-xs"
              >
                {copiedField === 'recordHash' ? <Check className="w-3 h-3 text-slate-900" /> : <Copy className="w-3 h-3" />}
                <span>{copiedField === 'recordHash' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <div className="p-1.5 rounded bg-white border border-slate-200 text-slate-800 break-all select-all">
              {currentRecord.recordHashSha256}
            </div>

            <div className="flex items-center justify-between text-slate-500 pt-1">
              <span>ECDSA P-256 Signature:</span>
              <button
                onClick={() => copyText(currentRecord.signatureHex, 'signature')}
                className="text-slate-700 hover:text-slate-900 flex items-center gap-1 cursor-pointer font-sans text-xs"
              >
                {copiedField === 'signature' ? <Check className="w-3 h-3 text-slate-900" /> : <Copy className="w-3 h-3" />}
                <span>{copiedField === 'signature' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <div className="p-1.5 rounded bg-white border border-slate-200 text-slate-800 break-all select-all">
              {currentRecord.signatureHex}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-2.5 border-t border-slate-100">
          {/* Tamper Simulation Trigger */}
          <div className="relative w-full sm:w-auto">
            <button
              onClick={() => setShowTamperMenu(!showTamperMenu)}
              disabled={isTampering}
              className="w-full sm:w-auto px-3 py-2 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 text-xs font-medium transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Flame className="w-3.5 h-3.5 text-slate-600" />
              <span>Simulate Tampering (Demo)</span>
            </button>

            {/* Dropdown Tampering Options */}
            {showTamperMenu && (
              <div className="absolute left-0 bottom-full mb-1.5 w-64 bg-white border border-slate-200 rounded-md shadow-lg p-1.5 z-20 space-y-1 text-xs">
                <div className="p-1.5 text-[10px] font-semibold text-slate-500 border-b border-slate-100">
                  Select Tamper Simulation:
                </div>
                <button
                  onClick={() => handleSimulateTamper('tamper_result')}
                  className="w-full text-left p-1.5 rounded hover:bg-slate-50 text-slate-800 transition flex items-center justify-between cursor-pointer"
                >
                  <span>Flip Result (Pos ↔ Neg)</span>
                </button>
                <button
                  onClick={() => handleSimulateTamper('tamper_confidence')}
                  className="w-full text-left p-1.5 rounded hover:bg-slate-50 text-slate-800 transition flex items-center justify-between cursor-pointer"
                >
                  <span>Alter Confidence Value</span>
                </button>
                <button
                  onClick={() => handleSimulateTamper('tamper_image')}
                  className="w-full text-left p-1.5 rounded hover:bg-slate-50 text-slate-800 transition flex items-center justify-between cursor-pointer"
                >
                  <span>Corrupt Stored Image Bytes</span>
                </button>
                <button
                  onClick={() => handleSimulateTamper('tamper_chain')}
                  className="w-full text-left p-1.5 rounded hover:bg-slate-50 text-slate-800 transition flex items-center justify-between cursor-pointer"
                >
                  <span>Break Hash Chain Link</span>
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => runVerification(currentRecord)}
              className="px-3 py-2 rounded-md bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer"
              title="Re-verify signature"
            >
              <RefreshCw className="w-3 h-3 text-slate-600" />
              <span>Re-Verify</span>
            </button>

            <button
              onClick={() => setShowFinalReport(true)}
              className="px-3 py-2 rounded-md bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition"
              title="View, copy, and print official final forensic report with complete time denotation"
            >
              <FileText className="w-3.5 h-3.5 text-slate-950" />
              <span>Final Report</span>
            </button>

            <button
              onClick={() => {
                onClose();
                if (onNavigateToLog) onNavigateToLog();
              }}
              className="flex-1 sm:flex-initial px-4 py-2 rounded-md bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs flex items-center justify-center gap-1.5 cursor-pointer transition"
            >
              <span>Evidence Ledger</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Official Final Forensic Report Modal */}
      <FinalReportModal
        isOpen={showFinalReport}
        record={currentRecord}
        onClose={() => setShowFinalReport(false)}
      />
    </div>
  );
};
