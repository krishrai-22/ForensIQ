/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Camera,
  Upload,
  Sparkles,
  RotateCw,
  Flashlight,
  AlertCircle,
  X,
  CheckCircle,
  ArrowRight,
  RotateCcw,
  Layers,
  FlaskConical,
  Grid,
} from 'lucide-react';
import { evaluateQualityGates, type QualityGateEvaluation } from '../lib/qualityGates.ts';
import {
  generateSyntheticSampleImage,
  generateSyntheticReferenceCardImage,
  type SyntheticPreset,
} from '../lib/syntheticImages.ts';

export interface CapturedImageData {
  imageUrl: string;
  blob: Blob;
  evaluation: QualityGateEvaluation;
}

export interface DualCaptureResult {
  sample: CapturedImageData;
  referenceCard: CapturedImageData;
  syntheticPresetUsed?: string;
  kitId?: string;
  reactionElapsedSeconds?: number;
  reactionTimeFlag?: 'ON_TIME' | 'EARLY' | 'LATE';
}

interface CaptureViewProps {
  onDualImagesCaptured: (data: DualCaptureResult) => void;
  activeKitName: string;
  requiredReadTimeSeconds?: number;
  readTimeToleranceSeconds?: number;
}

export const CaptureView: React.FC<CaptureViewProps> = ({
  onDualImagesCaptured,
  activeKitName,
  requiredReadTimeSeconds = 30,
  readTimeToleranceSeconds = 15,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Flow Step: 1 = Sample capture, 2 = Reference card capture, 3 = Review both
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);

  // Stored captures
  const [sampleCapture, setSampleCapture] = useState<CapturedImageData | null>(null);
  const [cardCapture, setCardCapture] = useState<CapturedImageData | null>(null);
  const [syntheticPresetUsed, setSyntheticPresetUsed] = useState<string | undefined>(undefined);

  // Reaction incubation timer state
  const [reactionTimerSeconds, setReactionTimerSeconds] = useState<number>(0);
  const [isReactionTimerRunning, setIsReactionTimerRunning] = useState<boolean>(false);
  const [capturedReactionSeconds, setCapturedReactionSeconds] = useState<number>(requiredReadTimeSeconds);

  // Camera hardware state
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showDemoModal, setShowDemoModal] = useState(false);

  // Start camera
  const startCamera = useCallback(async (mode: 'environment' | 'user') => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      setCameraError(null);
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setCameraActive(true);

      const videoTrack = stream.getVideoTracks()[0];
      const capabilities = videoTrack.getCapabilities ? videoTrack.getCapabilities() : {};
      // @ts-expect-error torch capability is vendor specific
      if (capabilities.torch) {
        setHasTorch(true);
      }
    } catch (err) {
      console.warn('Camera access unavailable:', err);
      setCameraError(
        'Camera access unavailable or blocked. Please enable camera permission, use Demo Images, or upload photos.'
      );
      setCameraActive(false);
    }
  }, []);

  useEffect(() => {
    startCamera(facingMode);
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [facingMode, startCamera]);

  const toggleTorch = async () => {
    if (!streamRef.current || !hasTorch) return;
    try {
      const track = streamRef.current.getVideoTracks()[0];
      const newTorchState = !torchOn;
      // @ts-expect-error torch constraint
      await track.applyConstraints({ advanced: [{ torch: newTorchState }] });
      setTorchOn(newTorchState);
    } catch (err) {
      console.warn('Torch toggle failed:', err);
    }
  };

  const flipCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Process and evaluate captured blob
  const processImageBlob = async (blob: Blob) => {
    setIsProcessing(true);
    try {
      const img = new Image();
      const url = URL.createObjectURL(blob);

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = url;
      });

      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || 800;
      canvas.height = img.naturalHeight || 600;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not acquire 2D canvas context');

      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const evaluation = evaluateQualityGates(imageData);

      const capturedItem: CapturedImageData = {
        imageUrl: url,
        blob,
        evaluation,
      };

      if (currentStep === 1) {
        setSampleCapture(capturedItem);
        // Advance to Step 2: Reference card capture
        setCurrentStep(2);
      } else {
        setCardCapture(capturedItem);
      }
    } catch (err) {
      alert('Error evaluating photo quality: ' + String(err));
    } finally {
      setIsProcessing(false);
    }
  };

  // Shutter trigger
  const handleShutter = async () => {
    if (!videoRef.current || !cameraActive) return;
    setIsProcessing(true);

    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D context unavailable');

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b || new Blob()), 'image/jpeg', 0.95);
      });

      await processImageBlob(blob);
    } catch (err) {
      alert('Failed to capture frame: ' + String(err));
      setIsProcessing(false);
    }
  };

  // File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processImageBlob(file);
  };

  // Synthetic Preset Selection (Single Step)
  const handleSelectPreset = async (preset: SyntheticPreset) => {
    setShowDemoModal(false);
    setIsProcessing(true);
    setSyntheticPresetUsed(preset);

    try {
      if (currentStep === 1) {
        // Generate isolated sample image
        const sampleResult = await generateSyntheticSampleImage(preset);
        const img = new Image();
        await new Promise<void>((r) => {
          img.onload = () => r();
          img.src = sampleResult.dataUrl;
        });

        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || 800;
        canvas.height = img.naturalHeight || 600;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        const evalRes = evaluateQualityGates(ctx.getImageData(0, 0, canvas.width, canvas.height));

        setSampleCapture({
          imageUrl: sampleResult.dataUrl,
          blob: sampleResult.blob,
          evaluation: evalRes,
        });

        // Move to step 2 automatically
        setCurrentStep(2);
      } else {
        // Generate isolated reference card image
        const cardResult = await generateSyntheticReferenceCardImage(preset);
        const img = new Image();
        await new Promise<void>((r) => {
          img.onload = () => r();
          img.src = cardResult.dataUrl;
        });

        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || 800;
        canvas.height = img.naturalHeight || 600;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        const evalRes = evaluateQualityGates(ctx.getImageData(0, 0, canvas.width, canvas.height));

        setCardCapture({
          imageUrl: cardResult.dataUrl,
          blob: cardResult.blob,
          evaluation: evalRes,
        });
      }
    } catch (err) {
      alert('Failed to load demo scenario: ' + String(err));
    } finally {
      setIsProcessing(false);
    }
  };

  // 1-Click Complete Scenario Loading (Generates BOTH sample and matching reference card)
  const handleSelectFullScenario = async (preset: SyntheticPreset) => {
    setShowDemoModal(false);
    setIsProcessing(true);
    setSyntheticPresetUsed(preset);

    try {
      // 1. Generate Sample Image
      const sampleResult = await generateSyntheticSampleImage(preset);
      const imgSample = new Image();
      await new Promise<void>((r) => {
        imgSample.onload = () => r();
        imgSample.src = sampleResult.dataUrl;
      });
      const canvasSample = document.createElement('canvas');
      canvasSample.width = imgSample.naturalWidth || 800;
      canvasSample.height = imgSample.naturalHeight || 600;
      const ctxSample = canvasSample.getContext('2d')!;
      ctxSample.drawImage(imgSample, 0, 0);
      const sampleEval = evaluateQualityGates(ctxSample.getImageData(0, 0, canvasSample.width, canvasSample.height));

      // 2. Generate Matching Reference Card Image
      const cardResult = await generateSyntheticReferenceCardImage(preset);
      const imgCard = new Image();
      await new Promise<void>((r) => {
        imgCard.onload = () => r();
        imgCard.src = cardResult.dataUrl;
      });
      const canvasCard = document.createElement('canvas');
      canvasCard.width = imgCard.naturalWidth || 800;
      canvasCard.height = imgCard.naturalHeight || 600;
      const ctxCard = canvasCard.getContext('2d')!;
      ctxCard.drawImage(imgCard, 0, 0);
      const cardEval = evaluateQualityGates(ctxCard.getImageData(0, 0, canvasCard.width, canvasCard.height));

      const sampleItem: CapturedImageData = {
        imageUrl: sampleResult.dataUrl,
        blob: sampleResult.blob,
        evaluation: sampleEval,
      };

      const cardItem: CapturedImageData = {
        imageUrl: cardResult.dataUrl,
        blob: cardResult.blob,
        evaluation: cardEval,
      };

      setSampleCapture(sampleItem);
      setCardCapture(cardItem);

      let targetKitId = 'cobalt-thiocyanate';
      if (preset.startsWith('marquis')) targetKitId = 'marquis-reagent';
      else if (preset.startsWith('duquenois')) targetKitId = 'duquenois-levine';

      // Instantly advance directly with both items ready and matching reagent kit
      onDualImagesCaptured({
        sample: sampleItem,
        referenceCard: cardItem,
        syntheticPresetUsed: preset,
        kitId: targetKitId,
        reactionElapsedSeconds: requiredReadTimeSeconds,
        reactionTimeFlag: 'ON_TIME',
      });
    } catch (err) {
      console.warn('Failed to load full test scenario:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Instant Virtual Reference Card for users capturing real samples without physical card
  const handleUseVirtualReferenceCard = async () => {
    setIsProcessing(true);
    try {
      const cardResult = await generateSyntheticReferenceCardImage('cobalt-positive-warm');
      const imgCard = new Image();
      await new Promise<void>((r) => {
        imgCard.onload = () => r();
        imgCard.src = cardResult.dataUrl;
      });
      const canvasCard = document.createElement('canvas');
      canvasCard.width = imgCard.naturalWidth || 800;
      canvasCard.height = imgCard.naturalHeight || 600;
      const ctxCard = canvasCard.getContext('2d')!;
      ctxCard.drawImage(imgCard, 0, 0);
      const cardEval = evaluateQualityGates(ctxCard.getImageData(0, 0, canvasCard.width, canvasCard.height));

      setCardCapture({
        imageUrl: cardResult.dataUrl,
        blob: cardResult.blob,
        evaluation: cardEval,
      });
    } catch (err) {
      console.warn('Failed to load virtual reference card:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Final confirmation when both sample and card are captured
  const handleConfirmBoth = () => {
    if (!sampleCapture || !cardCapture) return;

    const minOptimal = Math.max(0, requiredReadTimeSeconds - readTimeToleranceSeconds);
    const maxOptimal = requiredReadTimeSeconds + readTimeToleranceSeconds;
    const seconds = capturedReactionSeconds || requiredReadTimeSeconds;
    let flag: 'ON_TIME' | 'EARLY' | 'LATE' = 'ON_TIME';
    if (seconds < minOptimal) flag = 'EARLY';
    else if (seconds > maxOptimal) flag = 'LATE';

    onDualImagesCaptured({
      sample: sampleCapture,
      referenceCard: cardCapture,
      syntheticPresetUsed,
      reactionElapsedSeconds: seconds,
      reactionTimeFlag: flag,
    });
  };

  return (
    <div className="space-y-4 text-left">
      {/* Step Indicator Header in Minimal Lookalike Shades */}
      <div className="bg-[#f4f6fa] border border-slate-300 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Protocol Sequence
            </span>
            <span className="text-slate-300">·</span>
            <span className="text-xs font-semibold text-slate-900">
              {currentStep === 1 ? 'Step 1: Chemical Sample' : 'Step 2: Reference Card'}
            </span>
          </div>
          <p className="text-xs text-slate-500">
            {currentStep === 1
              ? 'Position reagent pouch inside reticle guide.'
              : 'Align color reference card under same lighting.'}
          </p>
        </div>

        {/* Step Badges */}
        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={() => setCurrentStep(1)}
            className={`px-3 py-1.5 rounded-lg border font-medium flex items-center gap-1.5 transition cursor-pointer ${
              currentStep === 1
                ? 'bg-[#0a192f] text-white border-[#0a192f] shadow-xs'
                : sampleCapture
                ? 'bg-white text-slate-800 border-slate-300 hover:bg-slate-100'
                : 'bg-white text-slate-400 border-slate-300'
            }`}
          >
            <FlaskConical className="w-3.5 h-3.5" />
            <span>1. Sample</span>
            {sampleCapture && <CheckCircle className="w-3 h-3 text-emerald-400" />}
          </button>

          <button
            onClick={() => {
              if (sampleCapture) setCurrentStep(2);
            }}
            disabled={!sampleCapture}
            className={`px-3 py-1.5 rounded-lg border font-medium flex items-center gap-1.5 transition ${
              currentStep === 2
                ? 'bg-[#0a192f] text-white border-[#0a192f] shadow-xs cursor-pointer'
                : cardCapture
                ? 'bg-white text-slate-800 border-slate-300 hover:bg-slate-100 cursor-pointer'
                : 'bg-white text-slate-400 border-slate-300 opacity-60 cursor-not-allowed'
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            <span>2. Ref Card</span>
            {cardCapture && <CheckCircle className="w-3 h-3 text-emerald-400" />}
          </button>
        </div>
      </div>

      {/* Review Banner if both images are captured */}
      {sampleCapture && cardCapture && (
        <div className="bg-[#f4f6fa] border border-slate-300 rounded-xl p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 flex items-center justify-center flex-shrink-0">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <h4 className="text-xs font-semibold text-slate-900">Both Photos Ready</h4>
              <p className="text-[11px] text-slate-500">
                Sample and reference card captured. Proceed to calibrate color matrix.
              </p>
            </div>
          </div>

          <button
            onClick={handleConfirmBoth}
            className="w-full sm:w-auto px-4 py-2 rounded-lg bg-[#0a192f] hover:bg-[#122847] text-white font-medium text-xs flex items-center justify-center gap-1.5 cursor-pointer transition shadow-xs"
          >
            <span>Proceed to Calibration</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Camera Viewfinder & Optical Guide Canvas (Minimal Monochrome Reticle) */}
      <div className="relative w-full aspect-[4/3] sm:aspect-[16/10] bg-slate-950 rounded-lg overflow-hidden border border-slate-800 flex items-center justify-center">
        {/* Live Video Feed */}
        <video
          ref={videoRef}
          playsInline
          muted
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            cameraActive ? 'opacity-100' : 'opacity-0'
          }`}
        />

        {/* Fallback Screen if camera unavailable */}
        {!cameraActive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center space-y-3 bg-slate-950">
            <div className="w-12 h-12 rounded-md bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400">
              <Camera className="w-6 h-6" />
            </div>
            <div className="max-w-md space-y-1">
              <h3 className="text-xs font-semibold text-slate-200">
                {currentStep === 1
                  ? 'Capture Reagent Sample'
                  : 'Capture Reference Card'}
              </h3>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                {cameraError ||
                  'Camera unavailable. Select a demo scenario or upload a photo to proceed.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <button
                onClick={() => setShowDemoModal(true)}
                className="px-3.5 py-1.5 rounded-md bg-white hover:bg-slate-100 text-slate-900 font-medium text-xs flex items-center gap-1.5 cursor-pointer transition"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Use Demo Preset</span>
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3.5 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 font-medium text-xs flex items-center gap-1.5 cursor-pointer transition"
              >
                <Upload className="w-3.5 h-3.5 text-slate-400" />
                <span>Upload Photo</span>
              </button>
            </div>
          </div>
        )}

        {/* Minimal Viewfinder Reticle Overlays */}
        {cameraActive && (
          <div className="absolute inset-0 pointer-events-none">
            {/* Step 1 Reticle: Centered Chemical Sample Reticle */}
            {currentStep === 1 && (
              <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                <path
                  d="M0,0 H100 V100 H0 Z M30,20 H70 V80 H30 Z"
                  fill="rgba(0, 0, 0, 0.35)"
                  fillRule="evenodd"
                />
                <rect
                  x="30"
                  y="20"
                  width="40"
                  height="60"
                  rx="3"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="0.6"
                  strokeDasharray="2 2"
                />
                <circle cx="50" cy="50" r="10" fill="none" stroke="#ffffff" strokeWidth="0.6" />
                <line x1="45" y1="50" x2="55" y2="50" stroke="#ffffff" strokeWidth="0.6" />
                <line x1="50" y1="45" x2="50" y2="55" stroke="#ffffff" strokeWidth="0.6" />
              </svg>
            )}

            {/* Step 2 Reticle: 6-Patch Reference Card Grid */}
            {currentStep === 2 && (
              <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                <path
                  d="M0,0 H100 V100 H0 Z M18,12 H82 V88 H18 Z"
                  fill="rgba(0, 0, 0, 0.4)"
                  fillRule="evenodd"
                />
                <rect
                  x="18"
                  y="12"
                  width="64"
                  height="76"
                  rx="2"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="0.6"
                />
                <rect x="23" y="24" width="24" height="16" rx="1" fill="none" stroke="#ffffff" strokeWidth="0.4" strokeDasharray="1.5 1" />
                <rect x="23" y="44" width="24" height="16" rx="1" fill="none" stroke="#ffffff" strokeWidth="0.4" strokeDasharray="1.5 1" />
                <rect x="23" y="64" width="24" height="16" rx="1" fill="none" stroke="#ffffff" strokeWidth="0.4" strokeDasharray="1.5 1" />
                <rect x="53" y="24" width="24" height="16" rx="1" fill="none" stroke="#ffffff" strokeWidth="0.4" strokeDasharray="1.5 1" />
                <rect x="53" y="44" width="24" height="16" rx="1" fill="none" stroke="#ffffff" strokeWidth="0.4" strokeDasharray="1.5 1" />
                <rect x="53" y="64" width="24" height="16" rx="1" fill="none" stroke="#ffffff" strokeWidth="0.4" strokeDasharray="1.5 1" />
              </svg>
            )}

            {/* Minimal Viewfinder Banner */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur-xs px-3 py-1 rounded-md border border-slate-700 text-[10px] font-mono text-slate-300 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
              <span>
                {currentStep === 1
                  ? 'AUTO-DETECT REAGENT SAMPLE'
                  : 'AUTO-DETECT REFERENCE CARD'}
              </span>
            </div>
          </div>
        )}

        {/* Processing Spinner Overlay */}
        {isProcessing && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-center space-y-2 z-30">
            <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <p className="text-[11px] text-slate-200 font-mono tracking-wider">
              EVALUATING QUALITY GATES...
            </p>
          </div>
        )}
      </div>

      {/* Current Capture Status Bar */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        {/* Sample Status Box */}
        <div
          onClick={() => setCurrentStep(1)}
          className={`p-3 rounded-xl border transition cursor-pointer flex items-center gap-3 shadow-2xs ${
            currentStep === 1
              ? 'bg-[#0a192f] text-white border-[#0a192f] shadow-xs'
              : sampleCapture
              ? 'bg-[#f4f6fa] border-slate-300 hover:border-slate-400'
              : 'bg-[#e9edf2] border-slate-300'
          }`}
        >
          <div className="w-10 h-10 rounded-lg bg-slate-200 border border-slate-300 overflow-hidden flex-shrink-0 flex items-center justify-center">
            {sampleCapture ? (
              <img src={sampleCapture.imageUrl} alt="Sample" className="w-full h-full object-cover" />
            ) : (
              <FlaskConical className={`w-4 h-4 ${currentStep === 1 ? 'text-slate-300' : 'text-slate-400'}`} />
            )}
          </div>
          <div className="min-w-0">
            <span className={`text-[10px] font-semibold uppercase tracking-wider block ${currentStep === 1 ? 'text-slate-300' : 'text-slate-500'}`}>
              1. Sample
            </span>
            <div className={`font-semibold truncate text-xs ${currentStep === 1 ? 'text-white' : 'text-slate-900'}`}>
              {sampleCapture ? 'Captured' : 'Pending'}
            </div>
            {sampleCapture && (
              <span className={`text-[10px] font-mono font-medium ${
                currentStep === 1
                  ? (sampleCapture.evaluation.passed ? 'text-emerald-300' : 'text-amber-300')
                  : (sampleCapture.evaluation.passed ? 'text-emerald-700' : 'text-amber-700')
              }`}>
                {sampleCapture.evaluation.passed ? 'Quality Pass' : 'Warnings'}
              </span>
            )}
          </div>
        </div>

        {/* Reference Card Status Box */}
        <div
          onClick={() => {
            if (sampleCapture) setCurrentStep(2);
          }}
          className={`p-3 rounded-xl border transition cursor-pointer flex items-center gap-3 shadow-2xs ${
            currentStep === 2
              ? 'bg-[#0a192f] text-white border-[#0a192f] shadow-xs'
              : cardCapture
              ? 'bg-[#f4f6fa] border-slate-300 hover:border-slate-400'
              : 'bg-[#e9edf2] border-slate-300 opacity-80'
          }`}
        >
          <div className="w-10 h-10 rounded-lg bg-slate-200 border border-slate-300 overflow-hidden flex-shrink-0 flex items-center justify-center">
            {cardCapture ? (
              <img src={cardCapture.imageUrl} alt="Card" className="w-full h-full object-cover" />
            ) : (
              <Grid className={`w-4 h-4 ${currentStep === 2 ? 'text-slate-300' : 'text-slate-400'}`} />
            )}
          </div>
          <div className="min-w-0">
            <span className={`text-[10px] font-semibold uppercase tracking-wider block ${currentStep === 2 ? 'text-slate-300' : 'text-slate-500'}`}>
              2. Color Card
            </span>
            <div className={`font-semibold truncate text-xs ${currentStep === 2 ? 'text-white' : 'text-slate-900'}`}>
              {cardCapture ? 'Captured' : 'Pending'}
            </div>
            {cardCapture && (
              <span className={`text-[10px] font-mono font-medium ${
                currentStep === 2
                  ? (cardCapture.evaluation.passed ? 'text-emerald-300' : 'text-amber-300')
                  : (cardCapture.evaluation.passed ? 'text-emerald-700' : 'text-amber-700')
              }`}>
                {cardCapture.evaluation.passed ? 'Quality Pass' : 'Warnings'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Step 2 Helper Bar: If sample is captured but user lacks physical card */}
      {currentStep === 2 && !cardCapture && (
        <div className="bg-[#f4f6fa] border border-slate-300 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs shadow-2xs">
          <div className="flex items-center gap-2 text-slate-700">
            <Grid className="w-3.5 h-3.5 text-slate-600 shrink-0" />
            <span className="text-[11px]">Don't have a physical NIST reference card handy in the field?</span>
          </div>
          <button
            onClick={handleUseVirtualReferenceCard}
            disabled={isProcessing}
            className="px-3 py-1.5 rounded-lg bg-[#0a192f] hover:bg-[#122847] text-white font-medium text-xs flex items-center justify-center gap-1.5 cursor-pointer transition shadow-2xs whitespace-nowrap"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Generate Virtual NIST Reference Card</span>
          </button>
        </div>
      )}

      {/* Camera & Input Controls Toolbar */}
      <div className="bg-white border border-slate-200 rounded-md p-3 flex items-center justify-between gap-3">
        {/* Secondary Actions */}
        <div className="flex items-center gap-2">
          {hasTorch && (
            <button
              onClick={toggleTorch}
              className={`p-2 rounded-md border transition cursor-pointer ${
                torchOn
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200'
              }`}
              title="Toggle Flashlight"
            >
              <Flashlight className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={flipCamera}
            className="p-2 rounded-md bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 transition cursor-pointer"
            title="Switch Camera"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 rounded-md bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 transition cursor-pointer"
            title="Upload Photo"
          >
            <Upload className="w-4 h-4 text-slate-700" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileUpload}
          />
        </div>

        {/* Primary Shutter Trigger */}
        <button
          onClick={handleShutter}
          disabled={!cameraActive || isProcessing}
          className="px-6 py-2.5 rounded-md bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white font-medium text-xs tracking-wide flex items-center gap-2 cursor-pointer transition"
        >
          <Camera className="w-3.5 h-3.5 fill-white" />
          <span>
            {currentStep === 1 ? 'CAPTURE SAMPLE' : 'CAPTURE CARD'}
          </span>
        </button>

        {/* Demo Preset Trigger */}
        <button
          onClick={() => setShowDemoModal(true)}
          className="px-3 py-2 rounded-md bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 text-xs font-medium transition flex items-center gap-1.5 cursor-pointer"
          title="Load Synthetic Demo Preset"
        >
          <Sparkles className="w-3.5 h-3.5 text-slate-700" />
          <span className="hidden sm:inline">Presets</span>
        </button>
      </div>

      {/* Synthetic Demo Presets Modal */}
      {showDemoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-md bg-white border border-slate-200 p-5 shadow-xl space-y-4 my-auto text-left">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-slate-800" />
                <h3 className="text-sm font-semibold text-slate-900">
                  Select Calibrated Scenario
                </h3>
              </div>
              <button
                onClick={() => setShowDemoModal(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 1-Click Complete Pair Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-900 uppercase tracking-wider">
                  ⚡ 1-Click Verification Scenarios (Loads Sample + Ref Card)
                </span>
                <span className="text-[10px] text-slate-500 font-medium">Ready for immediate testing</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <button
                  onClick={() => handleSelectFullScenario('cobalt-positive-warm')}
                  className="p-2.5 rounded-md bg-slate-50 hover:bg-blue-50/60 border border-slate-200 hover:border-blue-400 text-left transition cursor-pointer flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900 text-xs">Cocaine Positive</span>
                      <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-blue-100 text-blue-800">
                        POSITIVE
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Cobalt Thiocyanate precipitate with warm ambient lighting cast.
                    </p>
                  </div>
                  <span className="text-[10px] text-blue-700 font-medium mt-2">Load Full Pair &rarr;</span>
                </button>

                <button
                  onClick={() => handleSelectFullScenario('cobalt-negative-warm')}
                  className="p-2.5 rounded-md bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-400 text-left transition cursor-pointer flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900 text-xs">Cocaine Negative</span>
                      <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-slate-200 text-slate-800">
                        NEGATIVE
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Unreacted pink reagent solution indicating absence of cocaine.
                    </p>
                  </div>
                  <span className="text-[10px] text-slate-700 font-medium mt-2">Load Full Pair &rarr;</span>
                </button>

                <button
                  onClick={() => handleSelectFullScenario('marquis-positive-neutral')}
                  className="p-2.5 rounded-md bg-slate-50 hover:bg-purple-50/60 border border-slate-200 hover:border-purple-400 text-left transition cursor-pointer flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900 text-xs">Opiates Positive</span>
                      <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-purple-100 text-purple-800">
                        POSITIVE
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Marquis Reagent deep purple reaction under neutral daylight.
                    </p>
                  </div>
                  <span className="text-[10px] text-purple-700 font-medium mt-2">Load Full Pair &rarr;</span>
                </button>

                <button
                  onClick={() => handleSelectFullScenario('duquenois-positive-warm')}
                  className="p-2.5 rounded-md bg-slate-50 hover:bg-purple-50/60 border border-slate-200 hover:border-purple-400 text-left transition cursor-pointer flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900 text-xs">THC / Cannabis Positive</span>
                      <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-purple-100 text-purple-800">
                        POSITIVE
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Duquenois-Levine violet chloroform bottom layer.
                    </p>
                  </div>
                  <span className="text-[10px] text-purple-700 font-medium mt-2">Load Full Pair &rarr;</span>
                </button>
              </div>
            </div>

            {/* Individual Step Loading & Defect Tests */}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block">
                Quality Gate Diagnostic Tests:
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  onClick={() => handleSelectPreset('defect-blurry')}
                  className="p-2 rounded-md bg-white hover:bg-slate-50 border border-slate-200 text-left transition cursor-pointer"
                >
                  <div className="font-medium text-slate-800 text-[11px]">Blur Diagnostic</div>
                  <div className="text-[10px] text-slate-500">Motion/focus gate trigger</div>
                </button>
                <button
                  onClick={() => handleSelectPreset('defect-glare')}
                  className="p-2 rounded-md bg-white hover:bg-slate-50 border border-slate-200 text-left transition cursor-pointer"
                >
                  <div className="font-medium text-slate-800 text-[11px]">Specular Glare</div>
                  <div className="text-[10px] text-slate-500">Flash reflection test</div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
