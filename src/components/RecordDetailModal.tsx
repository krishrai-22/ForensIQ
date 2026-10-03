/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  FileText,
  ShieldCheck,
  ShieldAlert,
  Download,
  Copy,
  Check,
  Clock,
  User,
  MapPin,
  Cpu,
  Layers,
  ChevronDown,
  ChevronUp,
  X,
  RefreshCw,
  Flame,
  Scale,
  Package,
  CheckCircle2,
  XCircle,
  QrCode,
} from 'lucide-react';
import type { TestRecordEntity } from '../types/index.ts';
import {
  verifyTestRecord,
  simulateRecordTampering,
  type VerificationReport,
} from '../lib/recordSigning.ts';
import { createZipArchive } from '../lib/zipExporter.ts';
import { PresumptiveDisclaimerBanner } from './PresumptiveDisclaimerBanner.tsx';
import { ForensicQrTransferModal } from './ForensicQrTransferModal.tsx';
import { FinalReportModal } from './FinalReportModal.tsx';
import { extractTimeDenotation, generateForensicReportText } from '../lib/timeDenotation.ts';
import { db } from '../db/index.ts';

interface RecordDetailModalProps {
  isOpen: boolean;
  record: TestRecordEntity | null;
  onClose: () => void;
  onRecordUpdated?: () => void;
}

export const RecordDetailModal: React.FC<RecordDetailModalProps> = ({
  isOpen,
  record: initialRecord,
  onClose,
  onRecordUpdated,
}) => {
  const [currentRecord, setCurrentRecord] = useState<TestRecordEntity | null>(initialRecord);
  const [verificationReport, setVerificationReport] = useState<VerificationReport | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [sampleImageUrl, setSampleImageUrl] = useState<string | null>(null);
  const [cardImageUrl, setCardImageUrl] = useState<string | null>(null);
  const [activePhotoTab, setActivePhotoTab] = useState<'sample' | 'card'>('sample');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showMatrix, setShowMatrix] = useState(false);
  const [showTamperMenu, setShowTamperMenu] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showFinalReportModal, setShowFinalReportModal] = useState(false);

  useEffect(() => {
    setCurrentRecord(initialRecord);

    const sBlob = initialRecord?.sampleImageBlob || initialRecord?.imageBlob;
    if (sBlob) {
      const url = URL.createObjectURL(sBlob);
      setSampleImageUrl(url);
    } else {
      setSampleImageUrl(null);
    }

    if (initialRecord?.referenceCardImageBlob) {
      const cUrl = URL.createObjectURL(initialRecord.referenceCardImageBlob);
      setCardImageUrl(cUrl);
    } else {
      setCardImageUrl(null);
    }
  }, [initialRecord]);

  const runVerification = async (rec: TestRecordEntity) => {
    setIsVerifying(true);
    try {
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
      console.error('Verification failed:', err);
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

  // Export 1: Single JSON record with disclaimer
  const handleExportJson = () => {
    const exportBundle = {
      legalDisclaimer:
        'PRESUMPTIVE FIELD INDICATION ONLY: This record does not replace forensic laboratory confirmatory testing (GC/MS or LC/MS).',
      exportedAtIso: new Date().toISOString(),
      record: currentRecord,
    };

    const blob = new Blob([JSON.stringify(exportBundle, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fieldtest-record-${currentRecord.id.substring(0, 8)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Export 2: Complete Forensic Evidence Bundle (ZIP containing JSON + Image + Certificate)
  const handleExportBundleZip = async () => {
    const jsonText = JSON.stringify(
      {
        legalNotice:
          'PRESUMPTIVE FIELD TEST RECORD - DOES NOT REPLACE LABORATORY CONFIRMATORY TESTING.',
        record: currentRecord,
      },
      null,
      2
    );

    const certificateText = generateForensicReportText(currentRecord);

    const entries = [
      {
        filename: 'signed-record.json',
        data: new TextEncoder().encode(jsonText),
      },
      {
        filename: 'FORENSIC-CERTIFICATE.txt',
        data: new TextEncoder().encode(certificateText),
      },
    ];

    const sampleBlob = currentRecord.sampleImageBlob || currentRecord.imageBlob;
    if (sampleBlob) {
      const imgBuffer = await sampleBlob.arrayBuffer();
      entries.push({
        filename: 'reagent-sample.jpg',
        data: new Uint8Array(imgBuffer),
      });
    }

    if (currentRecord.referenceCardImageBlob) {
      const cardBuffer = await currentRecord.referenceCardImageBlob.arrayBuffer();
      entries.push({
        filename: 'reference-card.jpg',
        data: new Uint8Array(cardBuffer),
      });
    }

    const zipBlob = createZipArchive(entries);
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `evidence-bundle-${currentRecord.id.substring(0, 8)}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleTamper = async (
    mode: 'tamper_result' | 'tamper_confidence' | 'tamper_image' | 'tamper_chain'
  ) => {
    setShowTamperMenu(false);
    try {
      const tampered = await simulateRecordTampering(currentRecord.id, mode);
      setCurrentRecord(tampered);
      if (onRecordUpdated) onRecordUpdated();
    } catch (err) {
      alert('Tampering simulation failed: ' + String(err));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto">
      <div className="w-full max-w-3xl rounded-md bg-white border border-slate-200 shadow-xl p-5 text-left space-y-4 my-auto max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-md flex items-center justify-center flex-shrink-0 border ${
                verificationReport?.overallPass
                  ? 'bg-slate-50 text-slate-900 border-slate-300'
                  : 'bg-slate-100 text-slate-900 border-slate-400'
              }`}
            >
              {verificationReport?.overallPass ? (
                <ShieldCheck className="w-5 h-5 text-slate-800" />
              ) : (
                <ShieldAlert className="w-5 h-5 text-slate-900 animate-pulse" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  Evidence Record &amp; Custody Details
                </h2>
                <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded border border-slate-300 bg-slate-100 text-slate-800 font-semibold">
                  {currentRecord.result}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5 font-mono">
                UUID: {currentRecord.id}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mandatory Presumptive Legal Notice Banner */}
        <PresumptiveDisclaimerBanner />

        {/* Tamper Warning if triggered */}
        {verificationReport?.tamperDetected && (
          <div className="p-3.5 rounded-md bg-slate-100 border-2 border-slate-800 text-slate-900 text-xs space-y-1">
            <div className="flex items-center gap-2 font-bold text-slate-900 text-xs uppercase tracking-wider">
              <ShieldAlert className="w-4 h-4 text-slate-900" />
              <span>Cryptographic Integrity Alert: Tampering Detected</span>
            </div>
            <p className="text-slate-700 leading-relaxed text-[11px]">
              One or more cryptographic validation checks have failed. The payload, image, or previous hash does not match the ECDSA digital signature.
            </p>
          </div>
        )}

        {/* Image & Key Information Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Captured Photos */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-600 block">
                Evidence Photos
              </span>
              {cardImageUrl && (
                <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded border border-slate-200 text-[10px]">
                  <button
                    onClick={() => setActivePhotoTab('sample')}
                    className={`px-2 py-0.5 rounded font-medium transition cursor-pointer ${
                      activePhotoTab === 'sample' ? 'bg-white text-slate-900 shadow-xs border border-slate-200' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Sample
                  </button>
                  <button
                    onClick={() => setActivePhotoTab('card')}
                    className={`px-2 py-0.5 rounded font-medium transition cursor-pointer ${
                      activePhotoTab === 'card' ? 'bg-white text-slate-900 shadow-xs border border-slate-200' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Ref Card
                  </button>
                </div>
              )}
            </div>

            <div className="relative w-full aspect-[4/3] bg-slate-50 rounded-md overflow-hidden border border-slate-200 flex items-center justify-center">
              {activePhotoTab === 'sample' && sampleImageUrl ? (
                <img
                  src={sampleImageUrl}
                  alt="Captured field test sample"
                  className="w-full h-full object-contain"
                />
              ) : activePhotoTab === 'card' && cardImageUrl ? (
                <img
                  src={cardImageUrl}
                  alt="Captured reference card"
                  className="w-full h-full object-contain"
                />
              ) : (
                <span className="text-xs text-slate-400">Image not stored locally</span>
              )}
            </div>

            <div className="text-[10px] text-slate-500 font-mono truncate">
              {activePhotoTab === 'sample'
                ? `Sample SHA-256: ${currentRecord.sampleImageHashSha256 || currentRecord.imageHashSha256}`
                : `Card SHA-256: ${currentRecord.referenceCardImageHashSha256 || 'N/A'}`}
            </div>
          </div>

          {/* Core Metadata */}
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-600 block">
                Chain of Custody &amp; Time Denotation
              </span>
              <button
                onClick={() => setShowFinalReportModal(true)}
                className="text-[11px] text-blue-700 hover:text-blue-900 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <FileText className="w-3 h-3" />
                <span>View Full Report</span>
              </button>
            </div>

            <div className="bg-slate-50 p-3 rounded-md border border-slate-200 space-y-1.5 text-xs">
              {/* Chronological Time Denotation Block */}
              <div className="p-2 rounded bg-blue-50/70 border border-blue-200/80 space-y-1 text-[11px]">
                <div className="flex items-center justify-between text-blue-950 font-bold">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-blue-700" />
                    Time Denotation (Certified)
                  </span>
                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-blue-200/60 text-blue-900">
                    UTC &amp; Local
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-700 pt-0.5">
                  <span className="text-slate-500">Local Station Time:</span>
                  <span className="font-semibold text-slate-900">
                    {extractTimeDenotation(currentRecord).localFormatted}
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-700">
                  <span className="text-slate-500">UTC Timestamp (ISO):</span>
                  <span className="font-mono text-[10px] text-slate-800 break-all">
                    {currentRecord.timestampIso}
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-700">
                  <span className="text-slate-500">Monotonic Hardware:</span>
                  <span className="font-mono text-[10px] text-slate-800">
                    +{currentRecord.bootClockMs.toFixed(1)} ms baseline
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-700">
                  <span className="text-slate-500">Reaction Incubation Time:</span>
                  <span className="font-mono text-[10px] font-bold text-slate-900 flex items-center gap-1">
                    {currentRecord.reactionElapsedSeconds ? `${currentRecord.reactionElapsedSeconds}s` : '30s'}
                    <span className="text-[9px] font-semibold px-1 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                      {currentRecord.reactionTimeFlag || 'ON_TIME'}
                    </span>
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-center pt-1">
                <span className="text-slate-500">Officer / Unit:</span>
                <span className="font-semibold text-slate-900">
                  {currentRecord.operatorId} ({currentRecord.badgeUnit})
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-500">GPS Location:</span>
                <span className="font-mono text-slate-700 text-right">
                  {currentRecord.gps?.latitude !== null && currentRecord.gps?.longitude !== null
                    ? `${currentRecord.gps.latitude.toFixed(5)}, ${currentRecord.gps.longitude.toFixed(5)}`
                    : 'GPS Unavailable'}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-500">Reagent Protocol:</span>
                <span className="font-semibold text-slate-900 font-mono">
                  {currentRecord.kitProfileId}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-500">Calibration Quality:</span>
                <span className="font-mono font-semibold text-slate-800">
                  {currentRecord.calibrationData?.meanResidualDeltaE?.toFixed(1) || '0.0'} &Delta;E₀₀ ({currentRecord.calibrationData?.quality || 'N/A'})
                </span>
              </div>
            </div>

            {/* Rationale Quote */}
            <div className="p-3 rounded-md bg-slate-50 border border-slate-200 text-[11px] text-slate-700 leading-relaxed">
              <strong className="text-slate-900 block mb-0.5">Finding Rationale:</strong>
              {currentRecord.reason}
            </div>
          </div>
        </div>

        {/* 4-Point Cryptographic Audit Checklist */}
        <div className="bg-slate-50 p-3.5 rounded-md border border-slate-200 space-y-2">
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
            <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-slate-700" />
              Cryptographic Audit Breakdown
            </span>
            <button
              onClick={() => runVerification(currentRecord)}
              disabled={isVerifying}
              className="text-[11px] font-medium text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>{isVerifying ? 'Checking...' : 'Re-verify'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
            {verificationReport?.checks.map((chk, i) => (
              <div
                key={i}
                className="p-2.5 rounded-md border bg-white border-slate-200 text-slate-700 flex items-start justify-between gap-2"
              >
                <div className="flex items-start gap-1.5 min-w-0">
                  {chk.passed ? (
                    <CheckCircle2 className="w-4 h-4 text-slate-700 flex-shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-4 h-4 text-slate-900 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0">
                    <span className="font-semibold text-slate-900 block text-[11px] truncate">
                      {chk.name}
                    </span>
                    <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-2">
                      {chk.message}
                    </p>
                  </div>
                </div>

                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50 text-slate-700 font-semibold flex-shrink-0">
                  {chk.passed ? 'PASS' : 'FAIL'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Cryptographic Hashes & Signatures Accordion */}
        <div className="space-y-2">
          <button
            onClick={() => setShowMatrix(!showMatrix)}
            className="text-xs font-medium text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
          >
            <span>{showMatrix ? 'Hide' : 'Show'} Full Cryptographic Hashes &amp; Signatures</span>
            {showMatrix ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showMatrix && (
            <div className="p-3 rounded-md bg-slate-50 border border-slate-200 space-y-2 text-[11px] font-mono">
              <div>
                <span className="text-slate-500 block text-[10px] uppercase">Canonical Record Digest (SHA-256):</span>
                <span className="text-slate-800 break-all select-all">{currentRecord.recordHashSha256}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase">Predecessor Record Hash:</span>
                <span className="text-slate-800 break-all select-all">{currentRecord.prevRecordHash}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase">ECDSA P-256 Digital Signature:</span>
                <span className="text-slate-800 break-all select-all">{currentRecord.signatureHex}</span>
              </div>
            </div>
          )}
        </div>

        {/* Export & Actions Footer */}
        <div className="pt-3 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100">
          {/* Tamper simulation button */}
          <div className="relative w-full sm:w-auto">
            <button
              onClick={() => setShowTamperMenu(!showTamperMenu)}
              className="w-full sm:w-auto px-3 py-2 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-xs font-medium transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Flame className="w-3.5 h-3.5 text-slate-600" />
              <span>Simulate Tampering (Demo)</span>
            </button>

            {showTamperMenu && (
              <div className="absolute left-0 bottom-full mb-2 w-72 bg-white border border-slate-200 rounded-md shadow-lg p-1.5 z-20 space-y-1 text-xs">
                <button
                  onClick={() => handleTamper('tamper_result')}
                  className="w-full text-left p-2 rounded hover:bg-slate-100 text-slate-700 transition"
                >
                  Flip Result (Positive &harr; Negative)
                </button>
                <button
                  onClick={() => handleTamper('tamper_image')}
                  className="w-full text-left p-2 rounded hover:bg-slate-100 text-slate-700 transition"
                >
                  Corrupt Image Binary
                </button>
                <button
                  onClick={() => handleTamper('tamper_chain')}
                  className="w-full text-left p-2 rounded hover:bg-slate-100 text-slate-700 transition"
                >
                  Break Hash Chain Pointer
                </button>
              </div>
            )}
          </div>

          {/* Export Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={() => setShowQrModal(true)}
              className="flex-1 sm:flex-initial px-3 py-2 rounded-md bg-[#0a1d37] hover:bg-[#13325c] text-white font-medium text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
              title="Generate optical QR transfer barcode for desktop terminal scanner"
            >
              <QrCode className="w-3.5 h-3.5 text-amber-400" />
              <span>Terminal QR</span>
            </button>

            <button
              onClick={handleExportJson}
              className="flex-1 sm:flex-initial px-3 py-2 rounded-md bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-medium text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              <span>Export Record (JSON)</span>
            </button>

            <button
              onClick={() => setShowFinalReportModal(true)}
              className="flex-1 sm:flex-initial px-3.5 py-2 rounded-md bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
              title="View, copy, and print official final forensic report with complete chronological time denotation"
            >
              <FileText className="w-3.5 h-3.5 text-slate-950" />
              <span>Final Report (Time Certified)</span>
            </button>

            <button
              onClick={handleExportBundleZip}
              className="flex-1 sm:flex-initial px-3.5 py-2 rounded-md bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <Package className="w-3.5 h-3.5 text-slate-300" />
              <span>Export Evidence Bundle (ZIP)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Forensic Optical QR Transfer Modal */}
      <ForensicQrTransferModal
        isOpen={showQrModal}
        records={currentRecord ? [currentRecord] : []}
        onClose={() => setShowQrModal(false)}
      />

      {/* Official Final Forensic Report Modal */}
      <FinalReportModal
        isOpen={showFinalReportModal}
        record={currentRecord}
        onClose={() => setShowFinalReportModal(false)}
      />
    </div>
  );
};
