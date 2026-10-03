/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { CheckCircle2, XCircle, Play, X, ShieldCheck, Cpu } from 'lucide-react';
import { runClassifierUnitTests } from '../lib/__tests__/classify.test.ts';

interface UnitTestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UnitTestModal: React.FC<UnitTestModalProps> = ({ isOpen, onClose }) => {
  const [testResults, setTestResults] = useState<
    { testName: string; passed: boolean; details?: string }[] | null
  >(null);
  const [isRunning, setIsRunning] = useState(false);

  if (!isOpen) return null;

  const handleRunTests = () => {
    setIsRunning(true);
    setTimeout(() => {
      const results = runClassifierUnitTests();
      setTestResults(results);
      setIsRunning(false);
    }, 200);
  };

  const allPassed = testResults && testResults.every((r) => r.passed);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-md bg-white border border-slate-200 p-5 shadow-xl text-left space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-slate-700" />
            <h3 className="text-sm font-bold text-slate-900">
              Deterministic Classifier Unit Tests
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-700 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          Verifies that <code>classify()</code> functions as an explainable, pure mathematical decision tree without non-deterministic AI or cloud dependencies across clear positive, clear negative, ambiguous, and bad-lighting cases.
        </p>

        {/* Action Button */}
        <div className="flex items-center justify-between">
          <button
            onClick={handleRunTests}
            disabled={isRunning}
            className="px-3.5 py-2 rounded-md bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
          >
            <Play className="w-3 h-3 fill-white" />
            <span>{isRunning ? 'Running Tests...' : 'Execute Test Suite'}</span>
          </button>

          {testResults && (
            <span
              className="text-xs font-mono font-semibold px-2 py-0.5 rounded border border-slate-300 bg-slate-100 text-slate-800"
            >
              {allPassed ? 'ALL 6 TESTS PASSED' : 'TESTS FAILED'}
            </span>
          )}
        </div>

        {/* Results List */}
        {testResults ? (
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {testResults.map((r, i) => (
              <div
                key={i}
                className="p-2.5 rounded-md border border-slate-200 bg-slate-50 text-xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-medium text-slate-800">
                    {r.passed ? (
                      <CheckCircle2 className="w-4 h-4 text-slate-700 flex-shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-slate-900 flex-shrink-0" />
                    )}
                    <span>{r.testName}</span>
                  </div>
                  <span
                    className="text-[10px] font-semibold uppercase font-mono text-slate-600"
                  >
                    {r.passed ? 'PASS' : 'FAIL'}
                  </span>
                </div>
                {r.details && (
                  <p className="mt-1 text-[11px] text-slate-600 pl-6">{r.details}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 text-center border border-dashed border-slate-200 rounded-md bg-slate-50 text-slate-500 text-xs">
            Tap &quot;Execute Test Suite&quot; to run mathematical unit assertions.
          </div>
        )}

        <div className="pt-2 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium cursor-pointer transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
