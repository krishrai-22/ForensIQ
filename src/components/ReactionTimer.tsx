/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef } from 'react';
import { Play, Pause, RotateCcw, Clock, AlertTriangle, CheckCircle2, BellRing } from 'lucide-react';

interface ReactionTimerProps {
  requiredSeconds: number;
  toleranceSeconds: number;
  onTimingChange?: (elapsedSeconds: number, flag: 'ON_TIME' | 'EARLY' | 'LATE') => void;
  activeKitName: string;
}

export const ReactionTimer: React.FC<ReactionTimerProps> = ({
  requiredSeconds,
  toleranceSeconds,
  onTimingChange,
  activeKitName,
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const intervalRef = useRef<number | null>(null);

  // Compute read window
  const minOptimal = Math.max(0, requiredSeconds - toleranceSeconds);
  const maxOptimal = requiredSeconds + toleranceSeconds;

  let timingFlag: 'ON_TIME' | 'EARLY' | 'LATE' = 'ON_TIME';
  if (elapsedSeconds < minOptimal) {
    timingFlag = 'EARLY';
  } else if (elapsedSeconds > maxOptimal) {
    timingFlag = 'LATE';
  } else {
    timingFlag = 'ON_TIME';
  }

  // Play audio chime when entering optimal window
  const playChime = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.4);

      if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
      }
    } catch {
      // AudioContext policy fallback
    }
  };

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = window.setInterval(() => {
        setElapsedSeconds((prev) => {
          const next = prev + 1;
          if (next === minOptimal) {
            playChime();
          }
          return next;
        });
      }, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, minOptimal]);

  useEffect(() => {
    if (onTimingChange) {
      onTimingChange(elapsedSeconds, timingFlag);
    }
  }, [elapsedSeconds, timingFlag, onTimingChange]);

  const handleReset = () => {
    setIsRunning(false);
    setElapsedSeconds(0);
  };

  const remainingToOptimal = Math.max(0, requiredSeconds - elapsedSeconds);
  const progressPercent = Math.min(100, (elapsedSeconds / (maxOptimal * 1.2)) * 100);

  return (
    <div className="bg-white border border-slate-200 rounded-md p-4 space-y-3 text-left">
      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-slate-700" />
          <span className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
            Reaction Timer · {activeKitName}
          </span>
        </div>
        <span className="text-[11px] text-slate-500 font-mono">
          Target: {requiredSeconds}s (±{toleranceSeconds}s)
        </span>
      </div>

      {/* Timer Display & Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Big Digital Clock */}
        <div className="flex items-baseline gap-3">
          <div className="font-mono text-3xl font-bold tracking-tight text-slate-900">
            {Math.floor(elapsedSeconds / 60)
              .toString()
              .padStart(2, '0')}
            :{(elapsedSeconds % 60).toString().padStart(2, '0')}
          </div>

          {/* Status Badge in Lookalike Slate Shades */}
          {elapsedSeconds === 0 ? (
            <span className="text-xs px-2 py-0.5 rounded font-medium bg-slate-100 text-slate-600 border border-slate-200">
              Ready
            </span>
          ) : timingFlag === 'ON_TIME' ? (
            <span className="text-xs px-2 py-0.5 rounded font-medium bg-slate-900 text-white flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Optimal ({minOptimal}s – {maxOptimal}s)
            </span>
          ) : timingFlag === 'EARLY' ? (
            <span className="text-xs px-2 py-0.5 rounded font-medium bg-slate-100 text-slate-700 border border-slate-300 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              Early ({remainingToOptimal}s left)
            </span>
          ) : (
            <span className="text-xs px-2 py-0.5 rounded font-medium bg-slate-200 text-slate-800 border border-slate-300 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              Late (&gt; {maxOptimal}s)
            </span>
          )}
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          {!isRunning ? (
            <button
              onClick={() => setIsRunning(true)}
              className="flex-1 sm:flex-initial px-4 py-2 rounded-md bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs flex items-center justify-center gap-1.5 cursor-pointer transition"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>{elapsedSeconds > 0 ? 'Resume' : 'Start'}</span>
            </button>
          ) : (
            <button
              onClick={() => setIsRunning(false)}
              className="flex-1 sm:flex-initial px-4 py-2 rounded-md bg-slate-200 hover:bg-slate-300 text-slate-900 font-medium text-xs flex items-center justify-center gap-1.5 cursor-pointer transition"
            >
              <Pause className="w-3.5 h-3.5 fill-slate-900" />
              <span>Pause</span>
            </button>
          )}

          <button
            onClick={handleReset}
            disabled={elapsedSeconds === 0}
            className="p-2 rounded-md bg-white hover:bg-slate-100 disabled:opacity-40 text-slate-600 hover:text-slate-900 border border-slate-200 cursor-pointer transition"
            title="Reset Reaction Timer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Minimal Progress Bar */}
      <div className="space-y-1">
        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden relative">
          {/* Target window highlight */}
          <div
            className="absolute top-0 bottom-0 bg-slate-300"
            style={{
              left: `${(minOptimal / (maxOptimal * 1.2)) * 100}%`,
              width: `${((maxOptimal - minOptimal) / (maxOptimal * 1.2)) * 100}%`,
            }}
          />
          {/* Fill bar */}
          <div
            className="h-full bg-slate-900 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-slate-500 font-mono">
          <span>0s</span>
          <span className="text-slate-700 font-medium">{minOptimal}s</span>
          <span className="text-slate-900 font-semibold">{requiredSeconds}s (Target)</span>
          <span className="text-slate-700 font-medium">{maxOptimal}s</span>
          <span>{Math.round(maxOptimal * 1.2)}s</span>
        </div>
      </div>
    </div>
  );
};
