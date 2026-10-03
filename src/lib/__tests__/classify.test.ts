/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { classify, type ClassifyInput } from '../classifier.ts';
import type { KitProfile } from '../../types/index.ts';
import kitProfilesData from '../../data/kitProfiles.json';

const cobaltKit: KitProfile = kitProfilesData[0] as KitProfile;
const marquisKit: KitProfile = kitProfilesData[1] as KitProfile;

export function runClassifierUnitTests() {
  const results: { testName: string; passed: boolean; details?: string }[] = [];

  function assert(condition: boolean, testName: string, failureDetails: string) {
    if (condition) {
      results.push({ testName, passed: true });
    } else {
      results.push({ testName, passed: false, details: failureDetails });
    }
  }

  // --------------------------------------------------------------------------
  // TEST 1: Clear Positive Case (Cobalt Thiocyanate Cocaine Positive)
  // --------------------------------------------------------------------------
  {
    const positiveInput: ClassifyInput = {
      // Lab close to cocaine_positive [38.5, -12.4, -42.8]
      correctedSampleLab: [38.0, -12.0, -42.0],
      kitProfile: cobaltKit,
      calibrationQuality: 'GOOD',
      meanResidualDeltaE: 2.4,
      qualityGatesPassed: true,
      reactionElapsedSeconds: 30,
      reactionTimeFlag: 'ON_TIME',
    };

    const out = classify(positiveInput);
    assert(
      out.result === 'POSITIVE' && out.confidence >= 0.8 && out.bestDeltaE < 5.0,
      'Clear Positive (Cobalt Thiocyanate -> POSITIVE)',
      `Expected POSITIVE with confidence >= 0.8, got ${out.result} with conf ${out.confidence}, dE ${out.bestDeltaE}`
    );
  }

  // --------------------------------------------------------------------------
  // TEST 2: Clear Negative Case (Cobalt Thiocyanate Pink Unreacted)
  // --------------------------------------------------------------------------
  {
    const negativeInput: ClassifyInput = {
      // Lab close to negative_pink [68.2, 28.5, 8.2]
      correctedSampleLab: [68.0, 28.0, 8.0],
      kitProfile: cobaltKit,
      calibrationQuality: 'GOOD',
      meanResidualDeltaE: 3.1,
      qualityGatesPassed: true,
      reactionElapsedSeconds: 30,
      reactionTimeFlag: 'ON_TIME',
    };

    const out = classify(negativeInput);
    assert(
      out.result === 'NEGATIVE' && out.matchedOutcome?.id === 'negative_pink',
      'Clear Negative (Cobalt Thiocyanate -> NEGATIVE)',
      `Expected NEGATIVE matched to negative_pink, got ${out.result} with ${out.matchedOutcome?.id}`
    );
  }

  // --------------------------------------------------------------------------
  // TEST 3: Ambiguous Case (Color equidistant between Positive and Negative classes)
  // --------------------------------------------------------------------------
  {
    // Midpoint between positive [38.5, -12.4, -42.8] and negative [68.2, 28.5, 8.2]
    // Or construct a synthetic profile with two close outcomes
    const ambiguousProfile: KitProfile = {
      id: 'test-ambiguous-kit',
      name: 'Test Ambiguous Kit',
      substanceClass: 'Test Class',
      requiredReadTimeSeconds: 30,
      readTimeToleranceSeconds: 10,
      disclaimer: 'Test',
      version: '1.0',
      reagentSteps: [],
      outcomes: [
        {
          id: 'out_pos',
          label: 'Compound Alpha (Positive)',
          category: 'POSITIVE',
          referenceLab: [50.0, 20.0, 10.0],
          toleranceDeltaE: 20.0,
          description: '',
        },
        {
          id: 'out_neg',
          label: 'Compound Beta (Negative)',
          category: 'NEGATIVE',
          referenceLab: [50.0, 22.0, 10.0], // Very close to out_pos!
          toleranceDeltaE: 20.0,
          description: '',
        },
      ],
    };

    const ambiguousInput: ClassifyInput = {
      correctedSampleLab: [50.0, 20.8, 10.0],
      kitProfile: ambiguousProfile,
      calibrationQuality: 'GOOD',
      meanResidualDeltaE: 1.8,
      qualityGatesPassed: true,
    };

    const out = classify(ambiguousInput);
    assert(
      out.result === 'INCONCLUSIVE' && out.isAmbiguous === true && out.reason.includes('AMBIGUOUS'),
      'Ambiguous Case (Margin <= 3.5 deltaE -> INCONCLUSIVE)',
      `Expected INCONCLUSIVE with isAmbiguous=true, got result=${out.result}, isAmbiguous=${out.isAmbiguous}`
    );
  }

  // --------------------------------------------------------------------------
  // TEST 4: Bad Lighting / Poor Calibration Case
  // --------------------------------------------------------------------------
  {
    const badLightingInput: ClassifyInput = {
      correctedSampleLab: [38.0, -12.0, -42.0], // Perfect cocaine blue sample
      kitProfile: cobaltKit,
      calibrationQuality: 'POOR',
      meanResidualDeltaE: 14.8, // > 12.0 threshold!
      qualityGatesPassed: true,
    };

    const out = classify(badLightingInput);
    assert(
      out.result === 'INCONCLUSIVE' && out.reason.includes('calibration residual is excessive'),
      'Bad Lighting / Poor Calibration (meanResidual > 12.0 -> INCONCLUSIVE)',
      `Expected INCONCLUSIVE due to residual > 12.0, got ${out.result}: ${out.reason}`
    );
  }

  // --------------------------------------------------------------------------
  // TEST 5: Quality Gate Failure Case
  // --------------------------------------------------------------------------
  {
    const failedGatesInput: ClassifyInput = {
      correctedSampleLab: [38.0, -12.0, -42.0],
      kitProfile: cobaltKit,
      calibrationQuality: 'GOOD',
      meanResidualDeltaE: 2.1,
      qualityGatesPassed: false,
      qualityGateReasons: ['Excessive motion blur (Laplacian variance 22.4 < 45.0)'],
    };

    const out = classify(failedGatesInput);
    assert(
      out.result === 'INCONCLUSIVE' && out.confidence === 0.0 && out.reason.includes('quality gates failed'),
      'Quality Gates Failed (qualityGatesPassed=false -> INCONCLUSIVE)',
      `Expected INCONCLUSIVE with conf=0, got ${out.result} conf=${out.confidence}`
    );
  }

  // --------------------------------------------------------------------------
  // TEST 6: Out of Tolerance / Unknown Matrix Color
  // --------------------------------------------------------------------------
  {
    const outOfTolInput: ClassifyInput = {
      correctedSampleLab: [85.0, -25.0, 75.0], // Bright chartreuse yellow, unassociated with cocaine kit
      kitProfile: cobaltKit,
      calibrationQuality: 'GOOD',
      meanResidualDeltaE: 2.5,
      qualityGatesPassed: true,
    };

    const out = classify(outOfTolInput);
    assert(
      out.result === 'INCONCLUSIVE' && out.reason.includes('outside valid kit profile thresholds'),
      'Out of Tolerance / Unknown Color (deltaE > tolerance -> INCONCLUSIVE)',
      `Expected INCONCLUSIVE for out of tolerance color, got ${out.result}: ${out.reason}`
    );
  }

  return results;
}
