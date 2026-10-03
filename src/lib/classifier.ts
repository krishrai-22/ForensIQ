/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { deltaE00 } from './colorCorrection.ts';
import type { KitProfile, KitProfileOutcome, TestResultOutcome } from '../types/index.ts';

export interface ClassifyInput {
  correctedSampleLab: [number, number, number];
  kitProfile: KitProfile;
  calibrationQuality: 'GOOD' | 'ACCEPTABLE' | 'POOR';
  meanResidualDeltaE: number;
  qualityGatesPassed: boolean;
  qualityGateReasons?: string[];
  reactionElapsedSeconds?: number;
  reactionTimeFlag?: 'ON_TIME' | 'EARLY' | 'LATE';
  evaluationMode?: 'STRICT_COURT' | 'FIELD_ADVISORY';
  officerOverrideAdvisory?: boolean;
}

export interface OutcomeMatch {
  outcomeId: string;
  label: string;
  category: 'POSITIVE' | 'NEGATIVE' | 'INCONCLUSIVE';
  deltaE: number;
  toleranceDeltaE: number;
  withinTolerance: boolean;
}

export interface ClassificationResult {
  result: TestResultOutcome;
  matchedOutcome: KitProfileOutcome | null;
  bestDeltaE: number;
  confidence: number; // 0.00 to 1.00
  reason: string;
  matches: OutcomeMatch[];
  isAmbiguous: boolean;
  timingWarning?: string;
}

/**
 * Pure, deterministic classification function based on CIEDE2000 colorimetric distance
 * and rigorous quality criteria. Zero cloud AI / LLM calls.
 */
export function classify(input: ClassifyInput): ClassificationResult {
  const {
    correctedSampleLab,
    kitProfile,
    calibrationQuality,
    meanResidualDeltaE,
    qualityGatesPassed,
    qualityGateReasons = [],
    reactionElapsedSeconds,
    reactionTimeFlag,
    evaluationMode = 'STRICT_COURT',
    officerOverrideAdvisory = false,
  } = input;

  const isAdvisoryMode = evaluationMode === 'FIELD_ADVISORY' || officerOverrideAdvisory;

  // 1. Calculate CIEDE2000 distance to all outcome classes in this kit profile
  const matches: OutcomeMatch[] = kitProfile.outcomes.map((outcome) => {
    const dE = deltaE00(correctedSampleLab, outcome.referenceLab);
    return {
      outcomeId: outcome.id,
      label: outcome.label,
      category: outcome.category,
      deltaE: dE,
      toleranceDeltaE: outcome.toleranceDeltaE,
      withinTolerance: dE <= outcome.toleranceDeltaE,
    };
  });

  // Sort by ascending distance (closest match first)
  matches.sort((a, b) => a.deltaE - b.deltaE);
  const bestMatch = matches[0];
  const bestOutcomeObj =
    kitProfile.outcomes.find((o) => o.id === bestMatch?.outcomeId) || null;

  // Optional timing warning
  let timingWarning: string | undefined = undefined;
  if (reactionTimeFlag === 'EARLY') {
    timingWarning = `Early read at ${reactionElapsedSeconds ?? 0}s (Target: ${kitProfile.requiredReadTimeSeconds}s). Reagent reaction may not have reached peak colorimetric saturation.`;
  } else if (reactionTimeFlag === 'LATE') {
    timingWarning = `Late read at ${reactionElapsedSeconds ?? 0}s (Target: ${kitProfile.requiredReadTimeSeconds}s). Chemical degradation or oxidation may have altered the hue.`;
  }

  // -------------------------------------------------------------
  // REJECTION GATE 1: Image Quality Gates Failed
  // -------------------------------------------------------------
  if (!qualityGatesPassed) {
    const reasonsStr = qualityGateReasons.length > 0
      ? qualityGateReasons.join(', ')
      : 'Deficient focus, illumination, or glare';

    if (!isAdvisoryMode) {
      return {
        result: 'INCONCLUSIVE',
        matchedOutcome: null,
        bestDeltaE: bestMatch ? bestMatch.deltaE : 999,
        confidence: 0.0,
        reason: `INCONCLUSIVE: Photographic quality gates failed (${reasonsStr}). Cannot establish evidentiary validity. Retake required.`,
        matches,
        isAmbiguous: false,
        timingWarning,
      };
    }
  }

  // -------------------------------------------------------------
  // REJECTION GATE 2: Poor Calibration Quality
  // -------------------------------------------------------------
  if (calibrationQuality === 'POOR' || meanResidualDeltaE > 12.0) {
    if (!isAdvisoryMode) {
      return {
        result: 'INCONCLUSIVE',
        matchedOutcome: null,
        bestDeltaE: bestMatch ? bestMatch.deltaE : 999,
        confidence: Math.max(0.05, Number((0.4 - meanResidualDeltaE / 60).toFixed(2))),
        reason: `INCONCLUSIVE: Reference card calibration residual is excessive (${meanResidualDeltaE.toFixed(1)} ΔE₀₀ > 12.0 threshold). Ambient lighting is too uneven for reliable normalization.`,
        matches,
        isAmbiguous: false,
        timingWarning,
      };
    }
  }

  // -------------------------------------------------------------
  // REJECTION GATE 3: Best Match Exceeds Class Tolerance
  // -------------------------------------------------------------
  // In advisory mode, allow an extended field diagnostic tolerance up to 1.8x
  const effectiveTolerance = isAdvisoryMode && bestMatch
    ? bestMatch.toleranceDeltaE * 1.8
    : (bestMatch?.toleranceDeltaE ?? 25.0);

  if (!bestMatch || bestMatch.deltaE > effectiveTolerance) {
    const nearestDesc = bestMatch
      ? `"${bestMatch.label}" at ${bestMatch.deltaE.toFixed(1)} ΔE₀₀ (tolerance: ${bestMatch.toleranceDeltaE.toFixed(1)})`
      : 'Unknown';
    return {
      result: 'INCONCLUSIVE',
      matchedOutcome: null,
      bestDeltaE: bestMatch ? bestMatch.deltaE : 999,
      confidence: Math.max(0.18, Number((1 - (bestMatch?.deltaE ?? 100) / 80).toFixed(2))),
      reason: `INCONCLUSIVE: Sample color spectrum is outside valid kit profile thresholds. Nearest outcome is ${nearestDesc}. Possible contaminant, cutting agent, or atypical sample matrix.`,
      matches,
      isAmbiguous: false,
      timingWarning,
    };
  }

  // -------------------------------------------------------------
  // REJECTION GATE 4: Ambiguity between Top Classes of Different Categories
  // -------------------------------------------------------------
  // Look for the closest runner-up that belongs to a DIFFERENT category (e.g. POSITIVE vs NEGATIVE)
  const differentCategoryRunnerUp = matches.find(
    (m) => m.category !== bestMatch.category && m.outcomeId !== bestMatch.outcomeId
  );

  const AMBIGUITY_MARGIN = 3.5; // ΔE₀₀ margin
  if (differentCategoryRunnerUp) {
    const margin = differentCategoryRunnerUp.deltaE - bestMatch.deltaE;
    if (margin <= AMBIGUITY_MARGIN) {
      return {
        result: 'INCONCLUSIVE',
        matchedOutcome: null,
        bestDeltaE: bestMatch.deltaE,
        confidence: Math.max(0.25, Number((margin / 10).toFixed(2))),
        reason: `INCONCLUSIVE (AMBIGUOUS): Color distance is too close between conflicting categories: "${bestMatch.label}" (${bestMatch.deltaE.toFixed(1)} ΔE₀₀) vs "${differentCategoryRunnerUp.label}" (${differentCategoryRunnerUp.deltaE.toFixed(1)} ΔE₀₀, margin ${margin.toFixed(1)} <= ${AMBIGUITY_MARGIN} ΔE₀₀). Mandatory forensic laboratory analysis required.`,
        matches,
        isAmbiguous: true,
        timingWarning,
      };
    }
  }

  // -------------------------------------------------------------
  // CLEAR CATEGORICAL OUTCOME (POSITIVE or NEGATIVE)
  // -------------------------------------------------------------
  // Calculate deterministic confidence score:
  // Base confidence starts high at 0.96, decays gracefully as deltaE approaches tolerance
  const normalizedDistance = Math.min(1.5, bestMatch.deltaE / bestMatch.toleranceDeltaE);
  let confidence = Math.max(0.50, 0.98 - normalizedDistance * 0.38);

  // If calibration was merely "ACCEPTABLE" rather than "GOOD", apply modest 10% penalty
  if (calibrationQuality === 'ACCEPTABLE') {
    confidence *= 0.92;
  } else if (calibrationQuality === 'POOR' || meanResidualDeltaE > 12.0) {
    confidence *= 0.82;
  }

  // If reaction read was early or late, apply modest 8% penalty
  if (reactionTimeFlag && reactionTimeFlag !== 'ON_TIME') {
    confidence *= 0.92;
  }

  // If quality gates failed but advisory override mode enabled
  if (!qualityGatesPassed) {
    confidence *= 0.88;
  }

  // If within extended advisory tolerance (> 1.0x tolerance but <= 1.8x)
  const isExtendedTolerance = bestMatch.deltaE > bestMatch.toleranceDeltaE;
  if (isExtendedTolerance) {
    confidence *= 0.85;
  }

  confidence = Math.max(0.40, Number(confidence.toFixed(2)));

  let reason = '';
  const advisoryNotes: string[] = [];
  if (!qualityGatesPassed) {
    const reasonsStr = qualityGateReasons.length > 0 ? qualityGateReasons.join(', ') : 'Quality defect';
    advisoryNotes.push(`Photographic quality advisory: ${reasonsStr}`);
  }
  if (calibrationQuality === 'POOR' || meanResidualDeltaE > 12.0) {
    advisoryNotes.push(`Calibration residual elevated (${meanResidualDeltaE.toFixed(1)} ΔE₀₀)`);
  }
  if (isExtendedTolerance) {
    advisoryNotes.push(`Chromatic variance (${bestMatch.deltaE.toFixed(1)} ΔE₀₀ within extended field tolerance)`);
  }

  const advisoryPrefix = advisoryNotes.length > 0 ? `[FIELD ADVISORY: ${advisoryNotes.join('; ')}] ` : '';

  if (bestMatch.category === 'POSITIVE') {
    reason = `${advisoryPrefix}PRESUMPTIVE POSITIVE: Colorimetric response closely matches reference profile for ${bestMatch.label} (CIEDE2000 distance: ${bestMatch.deltaE.toFixed(1)} ΔE₀₀ within ${bestMatch.toleranceDeltaE.toFixed(1)} tolerance). Subject to mandatory confirmatory lab testing.`;
  } else if (bestMatch.category === 'NEGATIVE') {
    reason = `${advisoryPrefix}PRESUMPTIVE NEGATIVE: Colorimetric response corresponds to unreacted reagent indicating absence of target substance (${bestMatch.label} at ${bestMatch.deltaE.toFixed(1)} ΔE₀₀). Subject to confirmatory lab testing if reasonable suspicion persists.`;
  } else {
    reason = `${advisoryPrefix}INCONCLUSIVE: Matched profile indicator "${bestMatch.label}" (${bestMatch.deltaE.toFixed(1)} ΔE₀₀). Confirmatory testing recommended.`;
  }

  return {
    result: bestMatch.category,
    matchedOutcome: bestOutcomeObj,
    bestDeltaE: bestMatch.deltaE,
    confidence,
    reason,
    matches,
    isAmbiguous: false,
    timingWarning,
  };
}
