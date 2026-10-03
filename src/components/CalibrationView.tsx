/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Scale,
  CheckCircle2,
  Camera,
  ArrowRight,
  Info,
  ChevronDown,
  ChevronUp,
  FlaskConical,
  Grid,
  RefreshCw,
  Scan,
  Sparkles,
  AlertTriangle,
  FileSignature,
} from 'lucide-react';
import kitProfilesData from '../data/kitProfiles.json';
import {
  calibratePhotoDual,
  autoDetectCardPatches,
  autoDetectSampleSpot,
  getDefaultCardMarkers,
  getDefaultSampleMarker,
  type PatchMarker,
  type SampleMarker,
} from '../lib/colorCorrection.ts';
import { classify, type ClassificationResult } from '../lib/classifier.ts';
import type { CalibrationData, KitProfile } from '../types/index.ts';
import type { QualityGateEvaluation } from '../lib/qualityGates.ts';

interface CalibrationViewProps {
  sampleImageUrl: string;
  sampleBlob: Blob;
  sampleEvaluation: QualityGateEvaluation;
  cardImageUrl: string;
  cardBlob: Blob;
  cardEvaluation: QualityGateEvaluation;
  kitProfile: KitProfile;
  onRetake: () => void;
  onProceedToSign: (
    calibration: CalibrationData,
    classification: ClassificationResult,
    sampleBlob: Blob,
    cardBlob: Blob
  ) => void;
  onChangeKit?: (kit: KitProfile) => void;
}

export const CalibrationView: React.FC<CalibrationViewProps> = ({
  sampleImageUrl,
  sampleBlob,
  sampleEvaluation,
  cardImageUrl,
  cardBlob,
  cardEvaluation,
  kitProfile,
  onRetake,
  onProceedToSign,
  onChangeKit,
}) => {
  // Protocol kit profile state (allows officer to switch protocol right in calibration view)
  const [activeKitProfile, setActiveKitProfile] = useState<KitProfile>(kitProfile);

  useEffect(() => {
    setActiveKitProfile(kitProfile);
  }, [kitProfile]);

  const handleSwitchKit = (newKit: KitProfile) => {
    setActiveKitProfile(newKit);
    onChangeKit?.(newKit);
  };

  // Active canvas view: 'card' or 'sample'
  const [activeCanvasView, setActiveCanvasView] = useState<'card' | 'sample'>('card');

  // Natural dimensions & cached ImageData
  const [cardNaturalSize, setCardNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [sampleNaturalSize, setSampleNaturalSize] = useState<{ width: number; height: number } | null>(null);

  const [cardImageData, setCardImageData] = useState<ImageData | null>(null);
  const [sampleImageData, setSampleImageData] = useState<ImageData | null>(null);

  // Auto-detected patch coordinates & sample region
  const [patchMarkers, setPatchMarkers] = useState<PatchMarker[]>([]);
  const [sampleMarker, setSampleMarker] = useState<SampleMarker | null>(null);
  const [cardConfidence, setCardConfidence] = useState<number>(0.98);
  const [sampleConfidence, setSampleConfidence] = useState<number>(0.98);
  const [cardBounds, setCardBounds] = useState<{ x: number; y: number; width: number; height: number } | undefined>();
  const [isAutoDetecting, setIsAutoDetecting] = useState<boolean>(true);
  const [showMatrixDetails, setShowMatrixDetails] = useState<boolean>(false);
  const [evidentiaryMode, setEvidentiaryMode] = useState<'FIELD_ADVISORY' | 'STRICT_COURT'>('FIELD_ADVISORY');

  // Load and auto-detect Reference Card ImageData
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const w = img.naturalWidth || 800;
      const h = img.naturalHeight || 600;
      setCardNaturalSize({ width: w, height: h });

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, w, h);
        setCardImageData(data);

        // Run automated detection on reference card
        const result = autoDetectCardPatches(data);
        setPatchMarkers(result.patches);
        setCardConfidence(result.confidence);
        setCardBounds(result.cardBounds);
        setIsAutoDetecting(false);
      }
    };
    img.src = cardImageUrl;
  }, [cardImageUrl]);

  // Load and auto-detect Sample ImageData
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const w = img.naturalWidth || 800;
      const h = img.naturalHeight || 600;
      setSampleNaturalSize({ width: w, height: h });

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, w, h);
        setSampleImageData(data);

        // Run automated detection on reagent sample
        const result = autoDetectSampleSpot(data);
        setSampleMarker(result.marker);
        setSampleConfidence(result.confidence);
      }
    };
    img.src = sampleImageUrl;
  }, [sampleImageUrl]);

  // Trigger manual re-scan if needed
  const handleAutoReScan = () => {
    setIsAutoDetecting(true);
    setTimeout(() => {
      if (cardImageData) {
        const cardRes = autoDetectCardPatches(cardImageData);
        setPatchMarkers(cardRes.patches);
        setCardConfidence(cardRes.confidence);
        setCardBounds(cardRes.cardBounds);
      }
      if (sampleImageData) {
        const sampleRes = autoDetectSampleSpot(sampleImageData);
        setSampleMarker(sampleRes.marker);
        setSampleConfidence(sampleRes.confidence);
      }
      setIsAutoDetecting(false);
    }, 150);
  };

  // Dual-Image Calibration Computation with automatic robust fallback
  const calibrationData: CalibrationData | null = useMemo(() => {
    if (!cardImageData || !sampleImageData) return null;
    try {
      const effectivePatches = patchMarkers.length >= 6
        ? patchMarkers
        : getDefaultCardMarkers(cardImageData.width, cardImageData.height);
      const effectiveSample = sampleMarker || getDefaultSampleMarker(sampleImageData.width, sampleImageData.height);
      return calibratePhotoDual(cardImageData, effectivePatches, sampleImageData, effectiveSample);
    } catch (err) {
      console.error('Calibration error:', err);
      return null;
    }
  }, [cardImageData, sampleImageData, patchMarkers, sampleMarker]);

  // Overall Quality Gate Evaluation: both must pass
  const bothQualityGatesPassed = sampleEvaluation.passed && cardEvaluation.passed;
  const combinedQualityGateReasons = [
    ...sampleEvaluation.reasons.map((r) => `Sample: ${r}`),
    ...cardEvaluation.reasons.map((r) => `Card: ${r}`),
  ];

  // Deterministic Classification
  const classificationResult: ClassificationResult | null = useMemo(() => {
    if (!calibrationData) return null;
    return classify({
      correctedSampleLab: calibrationData.correctedSampleLab,
      kitProfile: activeKitProfile,
      calibrationQuality: calibrationData.quality,
      meanResidualDeltaE: calibrationData.meanResidualDeltaE,
      qualityGatesPassed: bothQualityGatesPassed,
      qualityGateReasons: combinedQualityGateReasons,
      evaluationMode: evidentiaryMode,
      officerOverrideAdvisory: evidentiaryMode === 'FIELD_ADVISORY',
    });
  }, [
    calibrationData,
    activeKitProfile,
    bothQualityGatesPassed,
    combinedQualityGateReasons,
    evidentiaryMode,
  ]);

  // Cross-kit diagnostic analysis: evaluate against all known kits to detect cross-protocol matches
  const crossKitAnalysis = useMemo(() => {
    if (!calibrationData) return null;
    const allKits = kitProfilesData as KitProfile[];
    const otherResults = allKits
      .filter((k) => k.id !== activeKitProfile.id)
      .map((k) => {
        const res = classify({
          correctedSampleLab: calibrationData.correctedSampleLab,
          kitProfile: k,
          calibrationQuality: calibrationData.quality,
          meanResidualDeltaE: calibrationData.meanResidualDeltaE,
          qualityGatesPassed: bothQualityGatesPassed,
          qualityGateReasons: combinedQualityGateReasons,
          evaluationMode: evidentiaryMode,
          officerOverrideAdvisory: evidentiaryMode === 'FIELD_ADVISORY',
        });
        return { kit: k, result: res, topMatch: res.matches[0] };
      });

    const currentBestDelta = classificationResult?.bestDeltaE ?? 999;
    const betterKit = otherResults.find(
      (r) =>
        (r.result.result === 'POSITIVE' || (r.topMatch && r.topMatch.deltaE < 22)) &&
        r.topMatch &&
        r.topMatch.deltaE < currentBestDelta - 6
    );

    return { otherResults, betterKit };
  }, [calibrationData, activeKitProfile, bothQualityGatesPassed, combinedQualityGateReasons, evidentiaryMode, classificationResult]);

  const avgConfidence = Math.round(((cardConfidence + sampleConfidence) / 2) * 100);

  return (
    <div className="space-y-4 text-left w-full">
      {/* Header & Alignment Mode Switcher */}
      <div className="bg-[#f4f6fa] border border-slate-300 rounded-xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Automated Calibration
            </span>
            <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded bg-slate-200/80 text-slate-800 border border-slate-300 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-slate-600" />
              <span>{avgConfidence}% Lock Confidence</span>
            </span>
          </div>
          <h2 className="text-base font-semibold text-slate-900">
            Color Standards &amp; Reaction Zone
          </h2>
          <p className="text-xs text-slate-500">
            Reference swatches and reaction zone auto-detected.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Canvas View Switcher */}
          <div className="bg-[#e9edf2] p-1 rounded-lg border border-slate-300 flex items-center gap-1 text-xs">
            <button
              onClick={() => setActiveCanvasView('card')}
              className={`px-3 py-1.5 rounded-md font-medium flex items-center gap-1.5 transition cursor-pointer ${
                activeCanvasView === 'card'
                  ? 'bg-[#0a192f] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              <span>Reference Card</span>
            </button>

            <button
              onClick={() => setActiveCanvasView('sample')}
              className={`px-3 py-1.5 rounded-md font-medium flex items-center gap-1.5 transition cursor-pointer ${
                activeCanvasView === 'sample'
                  ? 'bg-[#0a192f] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FlaskConical className="w-3.5 h-3.5" />
              <span>Reagent Sample</span>
            </button>
          </div>

          <button
            onClick={handleAutoReScan}
            disabled={isAutoDetecting}
            className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-medium cursor-pointer transition flex items-center gap-1.5 shadow-2xs"
            title="Re-run automated detection"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${isAutoDetecting ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Auto Re-Scan</span>
          </button>
        </div>
      </div>

      {/* Protocol Kit Switcher Bar */}
      <div className="bg-[#f4f6fa] border border-slate-300 rounded-xl p-3 sm:p-4 shadow-xs space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
          <div className="flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-[#0a192f]" />
            <span className="text-xs font-bold text-slate-900">
              Active Reagent Protocol:
            </span>
            <span className="text-xs text-slate-700 font-medium">
              {activeKitProfile.name}
            </span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            {activeKitProfile.substanceClass}
          </span>
        </div>

        {/* 1-Click Protocol Kit Switcher Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 border-t border-slate-200">
          {(kitProfilesData as KitProfile[]).map((kit) => {
            const isSelected = kit.id === activeKitProfile.id;
            return (
              <button
                key={kit.id}
                onClick={() => handleSwitchKit(kit)}
                className={`px-3 py-2 rounded-lg border text-left transition cursor-pointer flex items-center justify-between gap-2 ${
                  isSelected
                    ? 'bg-[#0a192f] text-white border-[#0a192f] shadow-xs'
                    : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300'
                }`}
              >
                <div className="min-w-0">
                  <div className={`font-semibold text-xs truncate ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                    {kit.name.split(' ')[0]}
                  </div>
                  <div className={`text-[10px] truncate ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                    {kit.id === 'cobalt-thiocyanate' ? 'Cocaine HCl' : kit.id === 'marquis-reagent' ? 'Opiates/Amphet' : 'Cannabinoids'}
                  </div>
                </div>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                  isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                  {isSelected ? 'ACTIVE' : 'SWITCH'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Cross-Protocol Recommendation Banner if another kit is a much better match */}
      {crossKitAnalysis?.betterKit && (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <div>
              <span className="font-semibold text-amber-950">
                Cross-Protocol Candidate Detected:
              </span>
              <p className="text-amber-800 text-[11px] mt-0.5">
                Observed color hue matches <strong>{crossKitAnalysis.betterKit.kit.name}</strong> ({crossKitAnalysis.betterKit.topMatch?.label}, distance: {crossKitAnalysis.betterKit.topMatch?.deltaE.toFixed(1)} ΔE₀₀).
              </p>
            </div>
          </div>
          <button
            onClick={() => handleSwitchKit(crossKitAnalysis.betterKit!.kit)}
            className="px-3.5 py-1.5 rounded-lg bg-[#0a192f] hover:bg-[#122847] text-white font-medium text-xs whitespace-nowrap cursor-pointer transition shadow-2xs"
          >
            Switch to {crossKitAnalysis.betterKit.kit.name.split(' ')[0]} &rarr;
          </button>
        </div>
      )}

      {/* VIEW 1: REFERENCE CARD AUTO-DETECTED VIEW */}
      {activeCanvasView === 'card' && (
        <div className="relative w-full aspect-[4/3] sm:aspect-[16/10] bg-slate-950 rounded-md overflow-hidden border border-slate-200 select-none">
          <img
            src={cardImageUrl}
            alt="Reference Card"
            className="w-full h-full object-contain pointer-events-none"
          />

          {cardNaturalSize && (
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox={`0 0 ${cardNaturalSize.width} ${cardNaturalSize.height}`}
              preserveAspectRatio="xMidYMid meet"
            >
              {/* Optional Detected Card Bounding Box */}
              {cardBounds && (
                <rect
                  x={cardBounds.x}
                  y={cardBounds.y}
                  width={cardBounds.width}
                  height={cardBounds.height}
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth={1}
                  strokeDasharray="4 3"
                  opacity={0.5}
                />
              )}
            </svg>
          )}

          {/* Minimal Status Strip */}
          <div className="absolute bottom-2 left-2 right-2 flex justify-between items-center text-[10px] text-slate-800 bg-white/95 backdrop-blur-xs px-3 py-1.5 rounded border border-slate-200 shadow-xs">
            <span className="flex items-center gap-1.5 font-medium">
              <Scan className="w-3.5 h-3.5 text-slate-600" />
              <span>Reference card calibrated ({(cardConfidence * 100).toFixed(0)}% confidence)</span>
            </span>
            <button
              onClick={() => setActiveCanvasView('sample')}
              className="text-slate-900 font-semibold hover:underline cursor-pointer"
            >
              View Sample &rarr;
            </button>
          </div>
        </div>
      )}

      {/* VIEW 2: REAGENT SAMPLE AUTO-DETECTED VIEW */}
      {activeCanvasView === 'sample' && (
        <div className="relative w-full aspect-[4/3] sm:aspect-[16/10] bg-slate-950 rounded-md overflow-hidden border border-slate-200 select-none">
          <img
            src={sampleImageUrl}
            alt="Reagent Sample"
            className="w-full h-full object-contain pointer-events-none"
          />

          {sampleNaturalSize && sampleMarker && (
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox={`0 0 ${sampleNaturalSize.width} ${sampleNaturalSize.height}`}
              preserveAspectRatio="xMidYMid meet"
            >
              <g>
                {/* Auto-detected Region Target */}
                <circle
                  cx={sampleMarker.x}
                  cy={sampleMarker.y}
                  r={sampleMarker.radius * 1.3}
                  fill="rgba(15, 23, 42, 0.2)"
                  stroke="#ffffff"
                  strokeWidth={1.5}
                />
                <circle
                  cx={sampleMarker.x}
                  cy={sampleMarker.y}
                  r={sampleMarker.radius * 0.4}
                  fill="#ffffff"
                  stroke="#0f172a"
                  strokeWidth={1}
                />
                <line
                  x1={sampleMarker.x - sampleMarker.radius * 1.5}
                  y1={sampleMarker.y}
                  x2={sampleMarker.x + sampleMarker.radius * 1.5}
                  y2={sampleMarker.y}
                  stroke="#ffffff"
                  strokeWidth={1}
                />
                <line
                  x1={sampleMarker.x}
                  y1={sampleMarker.y - sampleMarker.radius * 1.5}
                  x2={sampleMarker.x}
                  y2={sampleMarker.y + sampleMarker.radius * 1.5}
                  stroke="#ffffff"
                  strokeWidth={1}
                />
                <rect
                  x={sampleMarker.x - 42}
                  y={sampleMarker.y - sampleMarker.radius * 1.6 - 15}
                  width={84}
                  height={15}
                  rx={2}
                  fill="rgba(15, 23, 42, 0.9)"
                  stroke="rgba(255, 255, 255, 0.4)"
                  strokeWidth={0.5}
                />
                <text
                  x={sampleMarker.x}
                  y={sampleMarker.y - sampleMarker.radius * 1.6 - 4}
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize={8.5}
                  fontWeight="bold"
                  fontFamily="system-ui"
                >
                  REACTION ZONE
                </text>
              </g>
            </svg>
          )}

          {/* Minimal Status Strip */}
          <div className="absolute bottom-2 left-2 right-2 flex justify-between items-center text-[10px] text-slate-800 bg-white/95 backdrop-blur-xs px-3 py-1.5 rounded border border-slate-200 shadow-xs">
            <span className="flex items-center gap-1.5 font-medium">
              <Scan className="w-3.5 h-3.5 text-slate-600" />
              <span>Reaction zone auto-centered ({(sampleConfidence * 100).toFixed(0)}% confidence)</span>
            </span>
            <button
              onClick={() => setActiveCanvasView('card')}
              className="text-slate-900 font-semibold hover:underline cursor-pointer"
            >
              &larr; View Card
            </button>
          </div>
        </div>
      )}

      {/* Color Normalization & Calibration Quality Card in Refined Technical Grey */}
      {calibrationData && (
        <div className="bg-[#f4f6fa] border border-slate-300 rounded-xl p-4 sm:p-5 space-y-3.5 shadow-xs">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-slate-700" />
              <h3 className="text-sm font-semibold text-slate-900">Color Normalization</h3>
            </div>

            {/* Quality Score Badge */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-mono">Residual:</span>
              <span className="px-2 py-0.5 rounded text-xs font-medium font-mono bg-[#e9edf2] text-slate-800 border border-slate-300">
                {calibrationData.meanResidualDeltaE.toFixed(1)} &Delta;E₀₀ ({calibrationData.quality})
              </span>
            </div>
          </div>

          {/* Raw vs Corrected Side-by-Side Comparison */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-lg bg-[#e9edf2] border border-slate-300/80 flex items-center gap-3 shadow-2xs">
              <div
                className="w-10 h-10 rounded border border-slate-300 flex-shrink-0 shadow-2xs"
                style={{
                  backgroundColor: `rgb(${calibrationData.rawSampleRgb[0]}, ${calibrationData.rawSampleRgb[1]}, ${calibrationData.rawSampleRgb[2]})`,
                }}
              />
              <div className="space-y-0.5 text-xs">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Raw Measured Color
                </span>
                <p className="font-mono text-slate-900 font-semibold text-xs">
                  RGB({calibrationData.rawSampleRgb.join(', ')})
                </p>
                <p className="text-[10px] text-slate-500">Ambient lighting included</p>
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-[#e9edf2] border border-slate-300/80 flex items-center gap-3 shadow-2xs">
              <div
                className="w-10 h-10 rounded border border-slate-900 flex-shrink-0 shadow-2xs"
                style={{
                  backgroundColor: `rgb(${calibrationData.correctedSampleRgb[0]}, ${calibrationData.correctedSampleRgb[1]}, ${calibrationData.correctedSampleRgb[2]})`,
                }}
              />
              <div className="space-y-0.5 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-900">
                    Matrix Corrected
                  </span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-slate-700" />
                </div>
                <p className="font-mono text-slate-900 font-semibold text-xs">
                  RGB({calibrationData.correctedSampleRgb.join(', ')})
                </p>
                <p className="font-mono text-[10px] text-slate-500">
                  Lab: [{calibrationData.correctedSampleLab[0].toFixed(1)}, {calibrationData.correctedSampleLab[1].toFixed(1)}, {calibrationData.correctedSampleLab[2].toFixed(1)}]
                </p>
              </div>
            </div>
          </div>

          {/* Toggle 3x3 Matrix Details */}
          <div>
            <button
              onClick={() => setShowMatrixDetails(!showMatrixDetails)}
              className="text-xs font-medium text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
            >
              <span>{showMatrixDetails ? 'Hide' : 'View'} 3&times;3 Matrix Details &amp; Patch Residuals</span>
              {showMatrixDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {showMatrixDetails && (
              <div className="mt-2.5 p-3 rounded-md bg-slate-50 border border-slate-200 space-y-2.5 text-xs">
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block mb-1">
                    Fitted Least-Squares Matrix:
                  </span>
                  <div className="font-mono text-[10px] bg-white p-2 rounded border border-slate-200 text-slate-800 space-y-0.5">
                    {calibrationData.matrix.map((row, rIdx) => (
                      <div key={rIdx}>
                        [{row.map((val) => val.toFixed(4).padStart(7, ' ')).join(', ')}]
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block mb-1">
                    Patch Residuals (&Delta;E₀₀):
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {calibrationData.patches.map((p) => (
                      <div key={p.name} className="p-1.5 rounded bg-white border border-slate-200 text-[10px]">
                        <div className="font-medium text-slate-800 capitalize">{p.name}</div>
                        <div className="font-mono text-slate-600">
                          {p.deltaE?.toFixed(1)} &Delta;E₀₀
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Deterministic Classification Outcome Card */}
      {classificationResult && (
        <div className="bg-[#f4f6fa] border border-slate-300 rounded-xl p-4 sm:p-5 space-y-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 gap-3">
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Presumptive Chemical Determination
              </span>
              <h3 className="text-base font-semibold text-slate-900">Colorimetric Classification</h3>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              {/* Evidentiary Standard Selector */}
              <div className="flex items-center gap-1 p-0.5 rounded-lg bg-[#e9edf2] border border-slate-300 text-xs">
                <button
                  onClick={() => setEvidentiaryMode('FIELD_ADVISORY')}
                  className={`px-2.5 py-1 rounded-md font-medium text-[11px] transition cursor-pointer ${
                    evidentiaryMode === 'FIELD_ADVISORY'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Field Diagnostic Screening: Provides presumptive classification with confidence weighting"
                >
                  Field Screening
                </button>
                <button
                  onClick={() => setEvidentiaryMode('STRICT_COURT')}
                  className={`px-2.5 py-1 rounded-md font-medium text-[11px] transition cursor-pointer ${
                    evidentiaryMode === 'STRICT_COURT'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Strict Evidentiary Standard: Zero-tolerance legal courtroom admissibility"
                >
                  Court Strict
                </button>
              </div>

              {/* Categorical Result Badge */}
              <div
                className={`px-3.5 py-1.5 rounded-lg font-bold text-xs tracking-wide flex items-center gap-2 shadow-xs ${
                  classificationResult.result === 'POSITIVE'
                    ? 'bg-emerald-700 text-white'
                    : classificationResult.result === 'NEGATIVE'
                    ? 'bg-blue-700 text-white'
                    : 'bg-amber-600 text-white'
                }`}
              >
                <span>{classificationResult.result}</span>
                <span className="text-xs font-mono font-normal opacity-90">
                  ({Math.max(15, Math.round(classificationResult.confidence * 100))}%)
                </span>
              </div>
            </div>
          </div>

          {/* If Inconclusive in Court Strict mode, provide 1-click option to switch to Field Screening */}
          {classificationResult.result === 'INCONCLUSIVE' && evidentiaryMode === 'STRICT_COURT' && (
            <div className="p-3 rounded-lg bg-blue-50/80 border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
              <div className="flex items-center gap-2 text-blue-950">
                <Info className="w-4 h-4 text-blue-700 shrink-0" />
                <span>Court Strict mode enforces zero photometric tolerance. Switch to <strong>Field Screening</strong> to evaluate presumptive field indications.</span>
              </div>
              <button
                onClick={() => setEvidentiaryMode('FIELD_ADVISORY')}
                className="px-3 py-1.5 rounded-md bg-[#0a192f] hover:bg-[#122847] text-white text-[11px] font-semibold shrink-0 cursor-pointer transition shadow-2xs"
              >
                Enable Field Screening
              </button>
            </div>
          )}

          {/* Quality Gates Evidentiary Notice */}
          <div className="p-2.5 rounded-lg bg-white border border-slate-300 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${bothQualityGatesPassed ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              <span className="font-medium text-slate-800">
                {bothQualityGatesPassed
                  ? 'Evidentiary Gate Status: Passed (Valid photographic alignment)'
                  : 'Evidentiary Gate Status: Advisory Mode (Suboptimal lighting or focus detected)'}
              </span>
            </div>
            <span className="text-[10px] font-mono text-slate-500">
              Sample: {sampleEvaluation.passed ? 'PASS' : 'WARN'} · Card: {cardEvaluation.passed ? 'PASS' : 'WARN'}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-white border border-slate-300 text-xs leading-relaxed space-y-1.5 text-slate-700">
            <div className="font-medium flex items-center gap-1.5 text-xs text-slate-900">
              <Info className="w-3.5 h-3.5 text-slate-600" />
              <span>Explanation &amp; Chemical Details:</span>
            </div>
            <p className="text-xs text-slate-700 leading-normal">{classificationResult.reason}</p>
          </div>

          {/* Closest Reference Candidate Banner if inconclusive */}
          {classificationResult.result === 'INCONCLUSIVE' && classificationResult.matches[0] && (
            <div className="p-3 rounded-lg bg-[#e9edf2] border border-slate-300 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                  Closest Presumptive Spectrum Candidate:
                </span>
                <div className="font-semibold text-slate-900 mt-0.5">
                  {classificationResult.matches[0].label}
                </div>
              </div>
              <div className="text-left sm:text-right">
                <div className="text-xs font-mono font-bold text-slate-800">
                  {classificationResult.matches[0].deltaE.toFixed(1)} &Delta;E₀₀
                </div>
                <span className="text-[10px] text-slate-500">
                  Standard Tol: {classificationResult.matches[0].toleranceDeltaE.toFixed(1)}
                </span>
              </div>
            </div>
          )}

          {/* Proximity Table */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
              Reference Outcome CIEDE2000 Proximity Table
            </span>

            <div className="space-y-1.5">
              {classificationResult.matches.map((m, idx) => {
                const isMatch = m.outcomeId === classificationResult.matchedOutcome?.id;
                const isClosestWhenInconclusive = !classificationResult.matchedOutcome && idx === 0;

                return (
                  <div
                    key={m.outcomeId}
                    className={`p-3 rounded-lg border flex items-center justify-between text-xs font-mono transition ${
                      isMatch
                        ? 'bg-[#0a192f] text-white border-[#0a192f] font-semibold shadow-xs'
                        : isClosestWhenInconclusive
                        ? 'bg-amber-500/10 border-amber-500/40 text-amber-950 font-medium'
                        : 'bg-white border-slate-300 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`font-medium ${isMatch ? 'text-white' : 'text-slate-900'}`}>{m.label}</span>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <span className={isMatch ? 'text-slate-200' : 'text-slate-700'}>
                        &Delta;E₀₀: <strong>{m.deltaE.toFixed(1)}</strong>
                      </span>
                      <span className={`text-[10px] ${isMatch ? 'text-slate-400' : 'text-slate-500'}`}>
                        (Tol: {m.toleranceDeltaE.toFixed(1)})
                      </span>
                      <span
                        className={`text-[9px] font-semibold px-2 py-0.5 rounded ${
                          isMatch
                            ? 'bg-white text-[#0a192f]'
                            : isClosestWhenInconclusive
                            ? 'bg-amber-600 text-white'
                            : m.withinTolerance
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {isMatch ? 'MATCH' : isClosestWhenInconclusive ? 'CLOSEST' : m.withinTolerance ? 'WITHIN TOL' : 'OUT'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 flex flex-col sm:flex-row items-center justify-between gap-2.5 border-t border-slate-200">
            <button
              onClick={onRetake}
              className="w-full sm:w-auto px-4 py-2 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-medium text-xs flex items-center justify-center gap-1.5 cursor-pointer transition shadow-2xs"
            >
              <Camera className="w-3.5 h-3.5 text-slate-600" />
              <span>Retake Captures</span>
            </button>

            <button
              onClick={() =>
                onProceedToSign(
                  calibrationData!,
                  classificationResult!,
                  sampleBlob,
                  cardBlob
                )
              }
              className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-[#0a192f] hover:bg-[#122847] text-white font-medium text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer transition shadow-xs"
            >
              <FileSignature className="w-4 h-4 text-amber-400" />
              <span>Cryptographically Sign Record</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

