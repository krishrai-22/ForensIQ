/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Camera,
  ArrowRight,
  ShieldAlert,
  Sparkles,
  Sun,
  Eye,
} from 'lucide-react';
import type { QualityGateEvaluation } from '../lib/qualityGates.ts';

interface QualityGateReportProps {
  evaluation: QualityGateEvaluation;
  onRetake: () => void;
  onProceed: () => void;
}

export const QualityGateReport: React.FC<QualityGateReportProps> = ({
  evaluation,
  onRetake,
  onProceed,
}) => {
  const { overallStatus, items, canProceed } = evaluation;

  return (
    <div className="bg-white border border-slate-200 rounded-md p-4 sm:p-5 shadow-xs space-y-4 text-left">
      {/* Overall Status Banner */}
      <div
        className="p-3.5 rounded-md border border-slate-200 bg-slate-50 flex items-start gap-3"
      >
        <div className="flex-shrink-0 mt-0.5">
          {overallStatus === 'PASS' ? (
            <CheckCircle2 className="w-5 h-5 text-slate-800" />
          ) : overallStatus === 'WARN' ? (
            <AlertTriangle className="w-5 h-5 text-slate-700" />
          ) : (
            <XCircle className="w-5 h-5 text-slate-900" />
          )}
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span
              className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded border border-slate-300 bg-white text-slate-800 font-semibold"
            >
              Gate Status: {overallStatus}
            </span>
            <span className="font-semibold text-xs sm:text-sm text-slate-900">
              {overallStatus === 'PASS'
                ? 'Image Quality Gates Passed'
                : overallStatus === 'WARN'
                ? 'Acceptable Quality with Warnings'
                : 'Quality Gate Rejection &bull; Retake Required'}
            </span>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            {overallStatus === 'PASS'
              ? 'Sharpness, exposure balance, and specular glare levels are within calibration tolerances.'
              : overallStatus === 'WARN'
              ? 'Image meets minimum tolerances, but slight glare or illumination skew was detected.'
              : 'Photographic defects prevent accurate colorimetric calibration. Please review the remedial actions below and retake.'}
          </p>
        </div>
      </div>

      {/* Individual Gate Cards */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
          <Eye className="w-3.5 h-3.5 text-slate-500" />
          Individual Quality Gate Metrics
        </h3>

        <div className="grid grid-cols-1 gap-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="p-3 rounded-md border border-slate-200 bg-slate-50 text-xs"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-semibold text-slate-900">
                  {item.status === 'PASS' ? (
                    <CheckCircle2 className="w-4 h-4 text-slate-700 flex-shrink-0" />
                  ) : item.status === 'WARN' ? (
                    <AlertTriangle className="w-4 h-4 text-slate-600 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-slate-900 flex-shrink-0" />
                  )}
                  <span>{item.name}</span>
                </div>

                <div className="flex items-center gap-2 font-mono text-[11px]">
                  <span className="text-slate-500">{item.metricLabel}:</span>
                  <span
                    className="font-semibold text-slate-800"
                  >
                    {item.metricValue}
                  </span>
                  <span className="text-slate-400 text-[10px]">({item.thresholdLabel})</span>
                </div>
              </div>

              <p className="mt-1 text-slate-600 text-[11px] leading-relaxed pl-6">
                {item.message}
              </p>

              {/* Remedial Guidance if non-pass */}
              {item.correctiveAction && (
                <div className="mt-1.5 ml-6 p-2 rounded bg-white border border-slate-200 text-[11px] text-slate-700 flex items-start gap-1.5">
                  <span className="font-semibold uppercase tracking-wider text-[10px] bg-slate-100 text-slate-800 px-1 rounded flex-shrink-0 border border-slate-300">
                    Fix
                  </span>
                  <span>{item.correctiveAction}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-2 border-t border-slate-100">
        <button
          onClick={onRetake}
          className="w-full sm:w-auto px-4 py-2 rounded-md bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-medium text-xs flex items-center justify-center gap-1.5 cursor-pointer transition"
        >
          <Camera className="w-3.5 h-3.5 text-slate-500" />
          <span>Retake Photo</span>
        </button>

        <button
          onClick={onProceed}
          disabled={!canProceed}
          className={`w-full sm:w-auto px-4 py-2 rounded-md font-medium text-xs flex items-center justify-center gap-1.5 transition cursor-pointer ${
            canProceed
              ? 'bg-slate-900 hover:bg-slate-800 text-white'
              : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
          }`}
        >
          <span>Proceed to Calibration</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
