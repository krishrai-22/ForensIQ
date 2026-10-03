/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import {
  QrCode,
  X,
  Copy,
  Check,
  Download,
  Printer,
  ShieldCheck,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  Terminal,
  FileCode,
  ExternalLink,
  Layers,
} from 'lucide-react';
import type { TestRecordEntity } from '../types/index.ts';

interface ForensicQrTransferModalProps {
  isOpen: boolean;
  records: TestRecordEntity[];
  onClose: () => void;
  initialIndex?: number;
}

export const ForensicQrTransferModal: React.FC<ForensicQrTransferModalProps> = ({
  isOpen,
  records,
  onClose,
  initialIndex = 0,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [payloadMode, setPayloadMode] = useState<'standard' | 'full'>('standard');
  const [showPayloadInspector, setShowPayloadInspector] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    setCurrentIndex(Math.min(initialIndex, Math.max(0, records.length - 1)));
  }, [initialIndex, records]);

  const currentRecord: TestRecordEntity | undefined = records[currentIndex];

  // Construct payload according to selected mode
  const payloadString = React.useMemo(() => {
    if (!currentRecord) return '';

    if (payloadMode === 'standard') {
      // Streamlined standard forensic terminal optical transfer payload
      const standardPayload = {
        protocol: 'FIELDTEST-EVIDENCE-TRANSFER-V1',
        id: currentRecord.id,
        timestamp: currentRecord.timestampIso,
        localTime: new Date(currentRecord.timestampIso).toLocaleString(),
        reactionSeconds: currentRecord.reactionElapsedSeconds,
        reactionFlag: currentRecord.reactionTimeFlag,
        bootClockMs: currentRecord.bootClockMs,
        operator: currentRecord.operatorId,
        unit: currentRecord.badgeUnit,
        kit: currentRecord.kitProfileId,
        version: currentRecord.kitProfileVersion,
        result: currentRecord.result,
        confidence: Number((currentRecord.confidence * 100).toFixed(1)),
        deltaE: currentRecord.calibrationData?.meanResidualDeltaE
          ? Number(currentRecord.calibrationData.meanResidualDeltaE.toFixed(2))
          : undefined,
        sha256: currentRecord.recordHashSha256,
        imageSha256: currentRecord.imageHashSha256,
        signature: currentRecord.signatureHex,
        fingerprint: currentRecord.publicKeyFingerprint,
        tampered: Boolean(currentRecord.tampered),
        gps: currentRecord.gps
          ? {
              lat: currentRecord.gps.latitude,
              lng: currentRecord.gps.longitude,
              acc: currentRecord.gps.accuracyMeters,
            }
          : null,
      };
      return JSON.stringify(standardPayload);
    } else {
      // Full cryptographic bundle including full calibration and SPKI
      const fullPayload = {
        protocol: 'FIELDTEST-EVIDENCE-TRANSFER-FULL-V1',
        disclaimer:
          'PRESUMPTIVE FIELD INDICATION ONLY: Subject to mandatory laboratory confirmatory testing (GC/MS or LC/MS).',
        record: {
          id: currentRecord.id,
          timestampIso: currentRecord.timestampIso,
          bootClockMs: currentRecord.bootClockMs,
          operatorId: currentRecord.operatorId,
          badgeUnit: currentRecord.badgeUnit,
          kitProfileId: currentRecord.kitProfileId,
          kitProfileVersion: currentRecord.kitProfileVersion,
          result: currentRecord.result,
          confidence: currentRecord.confidence,
          reason: currentRecord.reason,
          reactionElapsedSeconds: currentRecord.reactionElapsedSeconds,
          reactionTimeFlag: currentRecord.reactionTimeFlag,
          calibrationData: currentRecord.calibrationData,
          recordHashSha256: currentRecord.recordHashSha256,
          imageHashSha256: currentRecord.imageHashSha256,
          prevRecordHash: currentRecord.prevRecordHash,
          publicKeyFingerprint: currentRecord.publicKeyFingerprint,
          signatureHex: currentRecord.signatureHex,
          tampered: currentRecord.tampered,
          gps: currentRecord.gps,
        },
      };
      return JSON.stringify(fullPayload);
    }
  }, [currentRecord, payloadMode]);

  // Generate QR code on payload change
  useEffect(() => {
    if (!payloadString) {
      setQrDataUrl('');
      return;
    }

    QRCode.toDataURL(payloadString, {
      errorCorrectionLevel: 'M',
      margin: 2,
      scale: 8,
      color: {
        dark: '#0a1d37',
        light: '#ffffff',
      },
    })
      .then((url) => {
        setQrDataUrl(url);
      })
      .catch((err) => {
        console.error('QR code generation failed:', err);
      });
  }, [payloadString]);

  if (!isOpen || !currentRecord) return null;

  const handleCopyPayload = async () => {
    try {
      await navigator.clipboard.writeText(payloadString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `evidence-qr-${currentRecord.id.substring(0, 8)}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handlePrintLabel = () => {
    const printWindow = window.open('', '_blank', 'width=600,height=700');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Evidence Label - ${currentRecord.id}</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace;
              padding: 24px;
              color: #0f172a;
              text-align: center;
              line-height: 1.4;
            }
            .border-box {
              border: 2px solid #0f172a;
              padding: 16px;
              border-radius: 8px;
              max-width: 440px;
              margin: 0 auto;
            }
            .header {
              font-size: 11px;
              font-weight: 700;
              letter-spacing: 1px;
              text-transform: uppercase;
              border-bottom: 1px solid #cbd5e1;
              padding-bottom: 8px;
              margin-bottom: 12px;
            }
            .title {
              font-size: 18px;
              font-weight: 800;
              margin-bottom: 4px;
            }
            .qr-img {
              width: 220px;
              height: 220px;
              margin: 10px auto;
              display: block;
            }
            .meta-table {
              font-size: 11px;
              text-align: left;
              width: 100%;
              border-collapse: collapse;
              margin-top: 8px;
            }
            .meta-table td {
              padding: 4px 2px;
              border-bottom: 1px dotted #e2e8f0;
            }
            .meta-table td.label {
              font-weight: 600;
              color: #475569;
              width: 35%;
            }
            .meta-table td.val {
              font-family: monospace;
              word-break: break-all;
            }
            .disclaimer {
              font-size: 9px;
              color: #64748b;
              margin-top: 12px;
              border-top: 1px solid #cbd5e1;
              padding-top: 8px;
            }
          </style>
        </head>
        <body>
          <div class="border-box">
            <div class="header">NATIONAL FORENSIC EVIDENCE SYSTEM · SECURE CHAIN OF CUSTODY</div>
            <div class="title">${currentRecord.result} PRESUMPTIVE RESULT</div>
            <p style="font-size: 12px; color: #475569; margin: 0 0 8px 0;">${currentRecord.kitProfileId} (v${currentRecord.kitProfileVersion})</p>
            <img class="qr-img" src="${qrDataUrl}" alt="Evidence QR" />
            <table class="meta-table">
              <tr><td class="label">RECORD UUID:</td><td class="val">${currentRecord.id}</td></tr>
              <tr><td class="label">TIMESTAMP:</td><td class="val">${currentRecord.timestampIso}</td></tr>
              <tr><td class="label">OFFICER / BADGE:</td><td class="val">${currentRecord.operatorId} (${currentRecord.badgeUnit})</td></tr>
              <tr><td class="label">SHA-256 DIGEST:</td><td class="val">${currentRecord.recordHashSha256.substring(0, 24)}...</td></tr>
              <tr><td class="label">INTEGRITY:</td><td class="val">${currentRecord.tampered ? 'TAMPERED / ALTERED' : 'CRYPTOGRAPHICALLY SEALED'}</td></tr>
            </table>
            <div class="disclaimer">
              PRESUMPTIVE FIELD INDICATION ONLY. Formal forensic laboratory analysis (GC/MS or LC/MS) is mandatory for evidentiary presentation.
            </div>
          </div>
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto">
      <div className="w-full max-w-xl rounded-xl bg-white border border-slate-200 shadow-2xl p-5 sm:p-6 text-left space-y-4 my-auto max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#0a1d37] text-white flex items-center justify-center shadow-xs flex-shrink-0">
              <QrCode className="w-5 h-5 text-amber-400" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  Forensic Terminal Optical Transfer
                </h2>
                {records.length > 1 && (
                  <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                    {currentIndex + 1} of {records.length}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Scan with a 2D optical scanner or terminal webcam to ingest custody record.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Multi-Record Navigation Bar (if multiple records provided) */}
        {records.length > 1 && (
          <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200 text-xs">
            <button
              onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
              disabled={currentIndex === 0}
              className="px-2.5 py-1 rounded bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-medium flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>

            <div className="text-center font-mono text-[11px] text-slate-600">
              Record UUID: <strong>{currentRecord.id.substring(0, 12)}...</strong>
            </div>

            <button
              onClick={() => setCurrentIndex((prev) => Math.min(records.length - 1, prev + 1))}
              disabled={currentIndex === records.length - 1}
              className="px-2.5 py-1 rounded bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-medium flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Optical Scanning Target Container */}
        <div className="text-center py-2 space-y-3">
          {/* Active Bridge Status Strip */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[11px] font-medium text-emerald-800">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>Optical Data Bridge Ready · High-Density 2D Barcode</span>
          </div>

          {/* QR Code Canvas / Image Presentation */}
          <div className="flex justify-center">
            <div className="p-3 bg-white rounded-xl border-2 border-slate-300 shadow-md inline-block">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt={`QR Code for record ${currentRecord.id}`}
                  className="w-56 h-56 sm:w-64 sm:h-64 object-contain mx-auto"
                />
              ) : (
                <div className="w-56 h-56 flex items-center justify-center text-xs text-slate-400">
                  Generating barcode...
                </div>
              )}
            </div>
          </div>

          {/* Record Quick Details Badge */}
          <div className="max-w-md mx-auto p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-left space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900">{currentRecord.result}</span>
                <span className="text-[11px] text-slate-500 font-mono">
                  ({Math.round(currentRecord.confidence * 100)}% Conf.)
                </span>
              </div>
              <div className="flex items-center gap-1 font-mono text-[11px] text-slate-500">
                <span>{currentRecord.kitProfileId}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600 pt-1 border-t border-slate-200">
              <div className="flex items-center gap-1">
                <Terminal className="w-3 h-3 text-slate-400" />
                <span className="font-mono text-[10px]">{currentRecord.operatorId}</span>
              </div>

              {currentRecord.tampered ? (
                <span className="flex items-center gap-1 text-[10px] font-bold text-slate-900 bg-slate-200 px-1.5 py-0.5 rounded">
                  <ShieldAlert className="w-3 h-3 text-slate-800" />
                  <span>ALTERED RECORD</span>
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  <span>SEALED ECDSA DIGEST</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Payload Format Selector & Inspector Toggle */}
        <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 text-[11px] font-medium">Payload:</span>
            <div className="inline-flex rounded-md bg-slate-100 p-0.5 border border-slate-200">
              <button
                onClick={() => setPayloadMode('standard')}
                className={`px-2 py-1 rounded text-[11px] font-medium transition cursor-pointer ${
                  payloadMode === 'standard'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Optimal for 2D barcode scanner guns and terminal webcams"
              >
                Standard Ingest
              </button>
              <button
                onClick={() => setPayloadMode('full')}
                className={`px-2 py-1 rounded text-[11px] font-medium transition cursor-pointer ${
                  payloadMode === 'full'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Includes complete SPKI public keys and calibration data"
              >
                Complete Envelope
              </button>
            </div>
          </div>

          <button
            onClick={() => setShowPayloadInspector(!showPayloadInspector)}
            className="text-[11px] text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer font-medium"
          >
            <FileCode className="w-3.5 h-3.5 text-slate-500" />
            <span>{showPayloadInspector ? 'Hide JSON' : 'Inspect JSON'}</span>
          </button>
        </div>

        {/* Expandable JSON Inspector */}
        {showPayloadInspector && (
          <div className="p-3 bg-slate-900 rounded-lg text-slate-200 font-mono text-[10px] overflow-x-auto max-h-48 border border-slate-800 leading-relaxed">
            <div className="flex justify-between items-center pb-1.5 mb-1.5 border-b border-slate-800 text-slate-400">
              <span>Decoded Optical Stream Payload ({payloadString.length} bytes)</span>
              <span>UTF-8 JSON</span>
            </div>
            <pre className="whitespace-pre-wrap">{JSON.stringify(JSON.parse(payloadString), null, 2)}</pre>
          </div>
        )}

        {/* Action Buttons */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyPayload}
              className="px-3 py-1.5 rounded-md bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-medium text-xs flex items-center gap-1.5 transition cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy JSON'}</span>
            </button>

            <button
              onClick={handlePrintLabel}
              className="px-3 py-1.5 rounded-md bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-medium text-xs flex items-center gap-1.5 transition cursor-pointer"
              title="Print physical evidence bag label with barcode"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span>Print Label</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadQr}
              className="px-3.5 py-1.5 rounded-md bg-[#0a1d37] hover:bg-[#13325c] text-white font-medium text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs"
            >
              <Download className="w-3.5 h-3.5 text-amber-400" />
              <span>Download Barcode (PNG)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
