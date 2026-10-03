/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  Sparkles,
  FlaskConical,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Eye,
  Loader2,
  Zap,
} from 'lucide-react';
import {
  generateSyntheticSampleImage,
  type SyntheticPreset,
} from '../lib/syntheticImages.ts';

export interface DemoScenarioItem {
  id: SyntheticPreset;
  kitId: string;
  title: string;
  substance: string;
  expectedResult: 'POSITIVE' | 'NEGATIVE' | 'REJECT';
  colorTag: string;
  accentColor: string;
  badgeBg: string;
  badgeText: string;
  description: string;
}

export const DEMO_SCENARIOS: DemoScenarioItem[] = [
  {
    id: 'cobalt-positive-warm',
    kitId: 'cobalt-thiocyanate',
    title: 'Cocaine Positive',
    substance: 'Cocaine HCl / Base',
    expectedResult: 'POSITIVE',
    colorTag: 'Cobalt Blue',
    accentColor: '#2563eb',
    badgeBg: 'bg-blue-100 text-blue-800 border-blue-300',
    badgeText: 'POSITIVE',
    description: 'Bright blue precipitate in Cobalt Thiocyanate reagent',
  },
  {
    id: 'cobalt-negative-warm',
    kitId: 'cobalt-thiocyanate',
    title: 'Cocaine Negative',
    substance: 'Non-controlled substance',
    expectedResult: 'NEGATIVE',
    colorTag: 'Unreacted Pink',
    accentColor: '#f43f5e',
    badgeBg: 'bg-slate-200 text-slate-800 border-slate-300',
    badgeText: 'NEGATIVE',
    description: 'Reagent solution remains pink, no precipitate forms',
  },
  {
    id: 'marquis-positive-neutral',
    kitId: 'marquis-reagent',
    title: 'Opiates Positive',
    substance: 'Heroin / Morphine',
    expectedResult: 'POSITIVE',
    colorTag: 'Deep Violet',
    accentColor: '#7c3aed',
    badgeBg: 'bg-purple-100 text-purple-800 border-purple-300',
    badgeText: 'POSITIVE',
    description: 'Marquis reagent rapid shift to deep purple/black',
  },
  {
    id: 'duquenois-positive-warm',
    kitId: 'duquenois-levine',
    title: 'THC / Cannabis',
    substance: 'Marijuana / Hashish',
    expectedResult: 'POSITIVE',
    colorTag: 'Violet Chloroform',
    accentColor: '#9333ea',
    badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    badgeText: 'POSITIVE',
    description: 'Violet layer extracts into lower chloroform phase',
  },
  {
    id: 'defect-blurry',
    kitId: 'cobalt-thiocyanate',
    title: 'Blurry Photo Defect',
    substance: 'Motion Gate Test',
    expectedResult: 'REJECT',
    colorTag: 'Laplace Var < 100',
    accentColor: '#eab308',
    badgeBg: 'bg-amber-100 text-amber-800 border-amber-300',
    badgeText: 'GATE REJECT',
    description: 'Defocused frame triggering optical blur gate rejection',
  },
  {
    id: 'defect-glare',
    kitId: 'cobalt-thiocyanate',
    title: 'Specular Glare Defect',
    substance: 'Flash Gate Test',
    expectedResult: 'REJECT',
    colorTag: 'Glare Blowout > 4%',
    accentColor: '#ef4444',
    badgeBg: 'bg-rose-100 text-rose-800 border-rose-300',
    badgeText: 'GATE REJECT',
    description: 'Saturated flash glare blowout on reaction pouch',
  },
];

// In-memory cache for generated thumbnail data URLs
const THUMBNAIL_CACHE: Record<string, string> = {};

interface DemoPicturesGalleryProps {
  onSelectScenario: (preset: SyntheticPreset, kitId: string) => void;
  selectedKitId?: string;
  compact?: boolean;
}

export const DemoPicturesGallery: React.FC<DemoPicturesGalleryProps> = ({
  onSelectScenario,
  compact = false,
}) => {
  const [thumbnails, setThumbnails] = useState<Record<string, string>>(THUMBNAIL_CACHE);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadThumbnails() {
      for (const item of DEMO_SCENARIOS) {
        if (!THUMBNAIL_CACHE[item.id]) {
          try {
            const res = await generateSyntheticSampleImage(item.id);
            THUMBNAIL_CACHE[item.id] = res.dataUrl;
            if (isMounted) {
              setThumbnails((prev) => ({ ...prev, [item.id]: res.dataUrl }));
            }
          } catch (e) {
            console.warn('Failed to generate thumbnail for', item.id, e);
          }
        }
      }
    }

    loadThumbnails();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleCardClick = async (item: DemoScenarioItem) => {
    setLoadingId(item.id);
    try {
      await onSelectScenario(item.id, item.kitId);
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="bg-[#f4f6fa] border border-slate-300 rounded-xl p-4 sm:p-5 shadow-xs space-y-3.5 text-left">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2.5 border-b border-slate-200 gap-1.5">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-[#0a192f] text-amber-400 flex items-center justify-center shrink-0">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <span>Demo Test Pictures &amp; Field Samples</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-semibold">
                Instant Verification
              </span>
            </h3>
            <p className="text-[11px] text-slate-500">
              Click any photo to immediately load the reagent sample &amp; reference card for forensic analysis.
            </p>
          </div>
        </div>
        <span className="text-[10px] font-mono text-slate-500 self-start sm:self-center">
          6 Calibrated Presets
        </span>
      </div>

      {/* Grid of Visual Cards */}
      <div className={`grid gap-3 ${compact ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}`}>
        {DEMO_SCENARIOS.map((item) => {
          const thumbUrl = thumbnails[item.id];
          const isLoading = loadingId === item.id;

          return (
            <div
              key={item.id}
              onClick={() => handleCardClick(item)}
              className="group relative bg-white border border-slate-300 hover:border-[#0a192f] rounded-lg overflow-hidden transition-all duration-200 hover:shadow-md cursor-pointer flex flex-col justify-between"
            >
              {/* Photo Thumbnail Container */}
              <div className="relative aspect-4/3 w-full bg-slate-900 overflow-hidden flex items-center justify-center">
                {thumbUrl ? (
                  <img
                    src={thumbUrl}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-500 space-y-1.5 p-4">
                    <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                    <span className="text-[10px] font-mono">Rendering sample...</span>
                  </div>
                )}

                {/* Overlaid Badges */}
                <div className="absolute top-2 left-2 flex items-center gap-1.5">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase border shadow-xs ${item.badgeBg}`}
                  >
                    {item.badgeText}
                  </span>
                </div>

                {/* Reaction Color Pip */}
                <div className="absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-xs text-[10px] font-medium text-white border border-white/20">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: item.accentColor }}
                  />
                  <span className="text-[9px] font-mono">{item.colorTag}</span>
                </div>

                {/* Hover Quick-Test Action Overlay */}
                <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white">
                  {isLoading ? (
                    <div className="flex items-center gap-2 bg-blue-600 px-3 py-1.5 rounded-md text-xs font-semibold shadow-lg">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Loading Sample...</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 bg-[#0a192f] border border-white/20 px-3 py-1.5 rounded-md text-xs font-semibold shadow-lg">
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      <span>Test This Picture &rarr;</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Card Meta Content */}
              <div className="p-3 space-y-1.5 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-1">
                    <h4 className="font-bold text-xs text-slate-900 group-hover:text-blue-900 truncate">
                      {item.title}
                    </h4>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium">
                    {item.substance}
                  </p>
                  <p className="text-[10px] text-slate-400 line-clamp-2 mt-1">
                    {item.description}
                  </p>
                </div>

                {/* Action Footer */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-semibold text-blue-900 group-hover:text-blue-700">
                  <span className="flex items-center gap-1">
                    <Eye className="w-3 h-3 text-slate-400" />
                    <span>Run Analysis</span>
                  </span>
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
