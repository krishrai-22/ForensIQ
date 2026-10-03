/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  FlaskConical,
  Camera,
  RotateCcw,
  Sparkles,
  Clock,
  ChevronDown,
  Info,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Zap,
} from 'lucide-react';
import { PresumptiveDisclaimerBanner } from '../PresumptiveDisclaimerBanner.tsx';
import { CaptureView, type DualCaptureResult } from '../CaptureView.tsx';
import { CalibrationView } from '../CalibrationView.tsx';
import { SignedRecordModal } from '../SignedRecordModal.tsx';
import { createAndSignTestRecord } from '../../lib/recordSigning.ts';
import { evaluateQualityGates } from '../../lib/qualityGates.ts';
import {
  generateSyntheticSampleImage,
  generateSyntheticReferenceCardImage,
  type SyntheticPreset,
} from '../../lib/syntheticImages.ts';
import type { OperatorProfile, KitProfile, CalibrationData, TestRecordEntity } from '../../types/index.ts';
import type { ClassificationResult } from '../../lib/classifier.ts';
import kitProfilesData from '../../data/kitProfiles.json';

interface TestTabProps {
  operator: OperatorProfile | null;
  onNavigateToSettings: () => void;
  onNavigateToLog?: () => void;
}

export const TestTab: React.FC<TestTabProps> = ({
  operator,
  onNavigateToSettings,
  onNavigateToLog,
}) => {
  const kitProfiles: KitProfile[] = kitProfilesData as KitProfile[];
  const [selectedKitId, setSelectedKitId] = useState<string>(kitProfiles[0].id);

  // Test Workflow Step: 'capture' (2-step capture) -> 'calibration' (calibration & classification)
  const [workflowStep, setWorkflowStep] = useState<'capture' | 'calibration'>('capture');

  // Stored captures for sample image and reference card image
  const [dualCaptureData, setDualCaptureData] = useState<DualCaptureResult | null>(null);

  // Signed Record state
  const [signedRecord, setSignedRecord] = useState<TestRecordEntity | null>(null);
  const [isSigning, setIsSigning] = useState<boolean>(false);
  const [showSignedModal, setShowSignedModal] = useState<boolean>(false);
  const [signingError, setSigningError] = useState<string | null>(null);

  const activeKit = kitProfiles.find((k) => k.id === selectedKitId) || kitProfiles[0];

  const handleDualImagesCaptured = (data: DualCaptureResult) => {
    if (data.kitId) {
      setSelectedKitId(data.kitId);
    }
    setDualCaptureData(data);
    setWorkflowStep('calibration');
  };

  const handleRetake = () => {
    setDualCaptureData(null);
    setWorkflowStep('capture');
  };

  // 1-Click Complete Scenario Loader
  const handleQuickLoadScenario = async (preset: SyntheticPreset, kitId: string) => {
    setSelectedKitId(kitId);
    setIsSigning(false);
    try {
      // 1. Generate Sample
      const sampleResult = await generateSyntheticSampleImage(preset);
      const img1 = new Image();
      await new Promise<void>((r) => { img1.onload = () => r(); img1.src = sampleResult.dataUrl; });
      const c1 = document.createElement('canvas');
      c1.width = img1.naturalWidth || 800;
      c1.height = img1.naturalHeight || 600;
      const ctx1 = c1.getContext('2d')!;
      ctx1.drawImage(img1, 0, 0);
      const sampleEval = evaluateQualityGates(ctx1.getImageData(0, 0, c1.width, c1.height));

      // 2. Generate Card
      const cardResult = await generateSyntheticReferenceCardImage(preset);
      const img2 = new Image();
      await new Promise<void>((r) => { img2.onload = () => r(); img2.src = cardResult.dataUrl; });
      const c2 = document.createElement('canvas');
      c2.width = img2.naturalWidth || 800;
      c2.height = img2.naturalHeight || 600;
      const ctx2 = c2.getContext('2d')!;
      ctx2.drawImage(img2, 0, 0);
      const cardEval = evaluateQualityGates(ctx2.getImageData(0, 0, c2.width, c2.height));

      setDualCaptureData({
        sample: {
          imageUrl: sampleResult.dataUrl,
          blob: sampleResult.blob,
          evaluation: sampleEval,
        },
        referenceCard: {
          imageUrl: cardResult.dataUrl,
          blob: cardResult.blob,
          evaluation: cardEval,
        },
        syntheticPresetUsed: preset,
        reactionElapsedSeconds: activeKit.requiredReadTimeSeconds || 30,
        reactionTimeFlag: 'ON_TIME',
      });

      setWorkflowStep('calibration');
    } catch (err) {
      console.error('Quick load error:', err);
      setSigningError('Error loading test scenario: ' + String(err));
    }
  };

  const handleProceedToSign = async (
    calibration: CalibrationData,
    classification: ClassificationResult,
    sampleBlob: Blob,
    cardBlob: Blob
  ) => {
    if (!dualCaptureData) return;
    if (!operator) {
      setSigningError(
        'Officer Session Inactive: An active sworn officer identity and device keypair are required to cryptographically seal this test record. Please enrol or log in an officer session.'
      );
      return;
    }

    setIsSigning(true);
    setSigningError(null);
    try {
      const record = await createAndSignTestRecord({
        kitProfileId: activeKit.id,
        kitProfileVersion: activeKit.version,
        calibrationData: calibration,
        classification,
        evaluation: dualCaptureData.sample.evaluation,
        reactionElapsedSeconds: dualCaptureData.reactionElapsedSeconds ?? activeKit.requiredReadTimeSeconds ?? 30,
        reactionTimeFlag: dualCaptureData.reactionTimeFlag ?? 'ON_TIME',
        sampleBlob,
        cardBlob,
      });

      setSignedRecord(record);
      setShowSignedModal(true);
    } catch (err) {
      console.error('Error signing record:', err);
      setSigningError('Record signing failed: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsSigning(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 w-full">
      {/* Mandatory Legal Disclaimer Banner - ALWAYS VISIBLE */}
      <PresumptiveDisclaimerBanner />

      {/* STEP 1 & 2: TWO-STEP CAPTURE WORKSTATION VIEW */}
      {workflowStep === 'capture' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left 5 Cols: Protocol Selection, Quick Tests & Procedure Guides */}
          <div className="lg:col-span-5 space-y-4 text-left">
            {/* Protocol Selection Tiles */}
            <div className="bg-[#f4f6fa] border border-slate-300 rounded-xl p-4 sm:p-5 shadow-xs space-y-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2.5 border-b border-slate-200 gap-2">
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-slate-900">
                    Reagent Test Protocol
                  </h2>
                  <p className="text-xs text-slate-500">
                    Select verified field chemical kit or load a 1-click test scenario.
                  </p>
                </div>
              </div>

              {/* Quick Scenario Pills */}
              <div className="p-3 rounded-lg bg-[#e9edf2] border border-slate-300 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                    <span>Quick Verification Scenarios</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">1-Click Tests</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                  <button
                    onClick={() => handleQuickLoadScenario('cobalt-positive-warm', 'cobalt-thiocyanate')}
                    className="px-2.5 py-1.5 rounded-md bg-white hover:bg-blue-50/80 text-blue-950 border border-slate-300 hover:border-blue-400 text-xs font-medium transition cursor-pointer text-left flex items-center justify-between shadow-2xs"
                  >
                    <span>Cocaine (+)</span>
                    <span className="text-[9px] font-mono font-bold text-blue-700 bg-blue-100/90 px-1.5 py-0.5 rounded">POS</span>
                  </button>
                  <button
                    onClick={() => handleQuickLoadScenario('cobalt-negative-warm', 'cobalt-thiocyanate')}
                    className="px-2.5 py-1.5 rounded-md bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 hover:border-slate-400 text-xs font-medium transition cursor-pointer text-left flex items-center justify-between shadow-2xs"
                  >
                    <span>Cocaine (-)</span>
                    <span className="text-[9px] font-mono font-bold text-slate-700 bg-slate-200/90 px-1.5 py-0.5 rounded">NEG</span>
                  </button>
                  <button
                    onClick={() => handleQuickLoadScenario('marquis-positive-neutral', 'marquis-reagent')}
                    className="px-2.5 py-1.5 rounded-md bg-white hover:bg-purple-50/80 text-purple-950 border border-slate-300 hover:border-purple-400 text-xs font-medium transition cursor-pointer text-left flex items-center justify-between shadow-2xs"
                  >
                    <span>Opiates (+)</span>
                    <span className="text-[9px] font-mono font-bold text-purple-700 bg-purple-100/90 px-1.5 py-0.5 rounded">POS</span>
                  </button>
                  <button
                    onClick={() => handleQuickLoadScenario('duquenois-positive-warm', 'duquenois-levine')}
                    className="px-2.5 py-1.5 rounded-md bg-white hover:bg-emerald-50/80 text-emerald-950 border border-slate-300 hover:border-emerald-400 text-xs font-medium transition cursor-pointer text-left flex items-center justify-between shadow-2xs"
                  >
                    <span>THC (+)</span>
                    <span className="text-[9px] font-mono font-bold text-emerald-700 bg-emerald-100/90 px-1.5 py-0.5 rounded">POS</span>
                  </button>
                </div>
              </div>

              {/* 3 Quick Protocol Cards */}
              <div className="space-y-2">
                {kitProfiles.map((kit) => {
                  const isSelected = kit.id === selectedKitId;
                  return (
                    <button
                      key={kit.id}
                      onClick={() => {
                        setSelectedKitId(kit.id);
                        setDualCaptureData(null);
                        setWorkflowStep('capture');
                      }}
                      className={`w-full p-3 rounded-lg border text-left transition cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'bg-blue-50/60 border-[#0c2340] ring-1 ring-[#0c2340] shadow-xs'
                          : 'bg-white/90 border-slate-300 hover:border-slate-400 hover:bg-white'
                      }`}
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2">
                          <FlaskConical className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-[#0c2340]' : 'text-slate-500'}`} />
                          <h3 className="font-bold text-xs text-slate-900 truncate">
                            {kit.name}
                          </h3>
                        </div>
                        <p className="text-[11px] text-slate-500 truncate">
                          {kit.substanceClass}
                        </p>
                      </div>

                      <div className="shrink-0 text-right">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${isSelected ? 'bg-[#0c2340] text-white' : 'bg-slate-200 text-slate-600'}`}>
                          {isSelected ? 'ACTIVE' : 'SELECT'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Procedure: Concise 3 Points */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200 text-xs">
                <div className="p-2 rounded bg-[#e9edf2] border border-slate-300/80 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#0c2340] text-white text-[10px] font-bold flex items-center justify-center shrink-0">1</span>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 text-xs truncate">Sample</p>
                    <p className="text-[10px] text-slate-500 truncate">1–2 mg</p>
                  </div>
                </div>

                <div className="p-2 rounded bg-[#e9edf2] border border-slate-300/80 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#0c2340] text-white text-[10px] font-bold flex items-center justify-center shrink-0">2</span>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 text-xs truncate">Reagent</p>
                    <p className="text-[10px] text-slate-500 truncate">Break vials</p>
                  </div>
                </div>

                <div className="p-2 rounded bg-[#e9edf2] border border-slate-300/80 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#0c2340] text-white text-[10px] font-bold flex items-center justify-center shrink-0">3</span>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 text-xs truncate">Scan</p>
                    <p className="text-[10px] text-slate-500 truncate">Auto-seal</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right 7 Cols: Live Viewfinder & Capture Station */}
          <div className="lg:col-span-7">
            <CaptureView
              activeKitName={activeKit.name}
              requiredReadTimeSeconds={activeKit.requiredReadTimeSeconds}
              readTimeToleranceSeconds={activeKit.readTimeToleranceSeconds}
              onDualImagesCaptured={handleDualImagesCaptured}
            />
          </div>
        </div>
      )}

      {/* STEP 3: CALIBRATION & CLASSIFICATION */}
      {workflowStep === 'calibration' && dualCaptureData && (
        <CalibrationView
          sampleImageUrl={dualCaptureData.sample.imageUrl}
          sampleBlob={dualCaptureData.sample.blob}
          sampleEvaluation={dualCaptureData.sample.evaluation}
          cardImageUrl={dualCaptureData.referenceCard.imageUrl}
          cardBlob={dualCaptureData.referenceCard.blob}
          cardEvaluation={dualCaptureData.referenceCard.evaluation}
          kitProfile={activeKit}
          onRetake={handleRetake}
          onProceedToSign={handleProceedToSign}
          onChangeKit={(kit) => setSelectedKitId(kit.id)}
        />
      )}

      {/* Signed Evidence Record Modal & Tamper Simulator */}
      <SignedRecordModal
        isOpen={showSignedModal}
        record={signedRecord}
        onClose={() => {
          setShowSignedModal(false);
          setDualCaptureData(null);
          setWorkflowStep('capture');
        }}
        onNavigateToLog={onNavigateToLog}
      />

      {/* Signing / Enrolment Error Modal */}
      {signingError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-md rounded-xl bg-white border border-slate-300 shadow-xl p-5 text-left space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-800 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Authentication &amp; Signing Notice
                </h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {signingError}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setSigningError(null);
                  onNavigateToSettings();
                }}
                className="flex-1 py-2 px-3 rounded-md bg-[#0a192f] hover:bg-[#132847] text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <span>Enrol / Log In Officer</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setSigningError(null)}
                className="py-2 px-3 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition cursor-pointer border border-slate-200"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
