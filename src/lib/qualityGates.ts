/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface QualityCheckItem {
  id: 'blur' | 'exposure' | 'glare';
  name: string;
  status: 'PASS' | 'WARN' | 'FAIL';
  metricLabel: string;
  metricValue: string;
  thresholdLabel: string;
  message: string;
  correctiveAction?: string;
}

export interface QualityGateEvaluation {
  passed: boolean;
  canProceed: boolean; // True if PASS or acceptable WARN with user acknowledgment
  overallStatus: 'PASS' | 'WARN' | 'FAIL';
  qualityScore: number; // 0 to 100%
  blurVariance: number;
  meanLuminance: number;
  glarePercent: number;
  items: QualityCheckItem[];
  reasons: string[];
}

/**
 * Evaluates photographic quality gates before colorimetric calibration:
 * 1. Blur Detection (Laplacian Kernel Variance)
 * 2. Exposure / Luminance (Under- and Over-exposure checks)
 * 3. Specular Glare / Hotspots (Saturated highlight blowout in sample/card region)
 */
export function evaluateQualityGates(
  imageData: ImageData,
  sampleRegion?: { x: number; y: number; width: number; height: number }
): QualityGateEvaluation {
  const { width, height, data } = imageData;
  const totalPixels = width * height;

  // 1. Grayscale luminance conversion (ITU-R BT.709 standard)
  const gray = new Float32Array(totalPixels);
  let totalLuminance = 0;
  let darkPixelCount = 0;
  let blownHighlightCount = 0;

  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 4;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    gray[i] = lum;
    totalLuminance += lum;

    if (lum < 20) darkPixelCount++;
    if (r > 248 && g > 248 && b > 248) blownHighlightCount++;
  }

  const meanLuminance = totalLuminance / totalPixels;

  // 2. Laplacian Variance (Blur Estimation)
  // Kernel: [0, 1, 0; 1, -4, 1; 0, 1, 0]
  // Downsample step if large image for real-time mobile performance
  const step = width > 800 ? 2 : 1;
  let laplacianSum = 0;
  let laplacianSqSum = 0;
  let laplacianCount = 0;

  for (let y = 1; y < height - 1; y += step) {
    const row = y * width;
    const prevRow = (y - 1) * width;
    const nextRow = (y + 1) * width;

    for (let x = 1; x < width - 1; x += step) {
      const center = gray[row + x];
      const val =
        gray[prevRow + x] +
        gray[nextRow + x] +
        gray[row + x - 1] +
        gray[row + x + 1] -
        4 * center;

      laplacianSum += val;
      laplacianSqSum += val * val;
      laplacianCount++;
    }
  }

  const meanLap = laplacianSum / (laplacianCount || 1);
  const blurVariance = Math.max(0, laplacianSqSum / (laplacianCount || 1) - meanLap * meanLap);

  // 3. Glare Detection in Sample Region (or entire image if region not bounded)
  let glarePixels = 0;
  let samplePixelCount = 0;

  const rx = sampleRegion ? Math.max(0, Math.floor(sampleRegion.x)) : Math.floor(width * 0.2);
  const ry = sampleRegion ? Math.max(0, Math.floor(sampleRegion.y)) : Math.floor(height * 0.2);
  const rw = sampleRegion ? Math.min(width - rx, Math.floor(sampleRegion.width)) : Math.floor(width * 0.6);
  const rh = sampleRegion ? Math.min(height - ry, Math.floor(sampleRegion.height)) : Math.floor(height * 0.6);

  for (let y = ry; y < ry + rh; y++) {
    const row = y * width;
    for (let x = rx; x < rx + rw; x++) {
      const idx = (row + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      // Specular glare: high brightness with clipped channels
      if (r > 248 && g > 248 && b > 248) {
        glarePixels++;
      }
      samplePixelCount++;
    }
  }

  const glarePercent = (glarePixels / (samplePixelCount || 1)) * 100;

  // Build Individual Gate Evaluations
  const items: QualityCheckItem[] = [];
  const reasons: string[] = [];

  // Gate 1: Blur Check
  let blurStatus: 'PASS' | 'WARN' | 'FAIL' = 'PASS';
  let blurMessage = 'Image is sharp. Edge contrast is optimal for patch alignment.';
  let blurAction: string | undefined = undefined;

  if (blurVariance < 15) {
    blurStatus = 'FAIL';
    blurMessage = 'Severe blur detected. High risk of calibration matrix corruption.';
    blurAction = 'Hold camera steady, tap to focus directly on card text, or maintain 15–25 cm distance.';
    reasons.push('Excessive motion or focus blur');
  } else if (blurVariance < 45) {
    blurStatus = 'WARN';
    blurMessage = 'Moderate softening detected. Calibration is possible but confidence may be reduced.';
    blurAction = 'Ensure lens is clean and steady phone against hand.';
    reasons.push('Moderate blur');
  }

  items.push({
    id: 'blur',
    name: 'Sharpness & Focus (Laplacian Variance)',
    status: blurStatus,
    metricLabel: 'Variance',
    metricValue: blurVariance.toFixed(1),
    thresholdLabel: '≥ 45.0 (Fail < 15.0)',
    message: blurMessage,
    correctiveAction: blurAction,
  });

  // Gate 2: Exposure / Luminance Check
  let expStatus: 'PASS' | 'WARN' | 'FAIL' = 'PASS';
  let expMessage = 'Lighting and exposure levels are balanced within dynamic range.';
  let expAction: string | undefined = undefined;

  // True underexposure: image is pitch black or severely crushed
  if (meanLuminance < 20 || (meanLuminance < 32 && (darkPixelCount / totalPixels) > 0.85)) {
    expStatus = 'FAIL';
    expMessage = 'Severe under-exposure (scene is too dark). Color channels cannot be reliably separated.';
    expAction = 'Move closer to ambient light, enable camera torch, or reposition cruiser light.';
    reasons.push('Under-exposed / insufficient illumination');
  } else if (meanLuminance < 45) {
    expStatus = 'WARN';
    expMessage = 'Low-light scene. Dark card patches may suffer shadow noise.';
    expAction = 'Increase illumination if possible for higher evidentiary confidence.';
    reasons.push('Dim lighting');
  } else if (meanLuminance > 242 || (blownHighlightCount / totalPixels) > 0.45) {
    expStatus = 'FAIL';
    expMessage = 'Severe over-exposure (scene is blown out). Color patches are clipped.';
    expAction = 'Step away from direct sunbeam, shade the card with your hand/body, or adjust camera exposure.';
    reasons.push('Over-exposed / blown highlights');
  } else if (meanLuminance > 212) {
    expStatus = 'WARN';
    expMessage = 'Bright exposure. Near highlight threshold.';
    expAction = 'Shield card from direct overhead lighting.';
    reasons.push('Bright scene');
  }

  items.push({
    id: 'exposure',
    name: 'Scene Exposure & Dynamic Range',
    status: expStatus,
    metricLabel: 'Mean Luminance',
    metricValue: `${meanLuminance.toFixed(0)} / 255`,
    thresholdLabel: '45 – 212',
    message: expMessage,
    correctiveAction: expAction,
  });

  // Gate 3: Specular Glare Check
  let glareStatus: 'PASS' | 'WARN' | 'FAIL' = 'PASS';
  let glareMessage = 'No specular flash reflection detected on target patches.';
  let glareAction: string | undefined = undefined;

  if (glarePercent > 18.0) {
    glareStatus = 'FAIL';
    glareMessage = 'Direct glare reflection detected in sample area. Saturated pixels destroy chemical hue.';
    glareAction = 'Tilt the phone 10°–15° off-axis so the reflective glare bounces away from the camera lens.';
    reasons.push('Specular reflection / hotspot');
  } else if (glarePercent > 4.0) {
    glareStatus = 'WARN';
    glareMessage = 'Minor hotspot detected near reagent ampoule or patch borders.';
    glareAction = 'Slightly angle device to eliminate glare before proceeding.';
    reasons.push('Minor hotspot reflection');
  }

  items.push({
    id: 'glare',
    name: 'Specular Glare & Reflections',
    status: glareStatus,
    metricLabel: 'Blown Highlights',
    metricValue: `${glarePercent.toFixed(1)}%`,
    thresholdLabel: '< 4.0% (Fail > 18.0%)',
    message: glareMessage,
    correctiveAction: glareAction,
  });

  // Determine overall status
  const hasFail = items.some((i) => i.status === 'FAIL');
  const hasWarn = items.some((i) => i.status === 'WARN');

  const overallStatus: 'PASS' | 'WARN' | 'FAIL' = hasFail ? 'FAIL' : hasWarn ? 'WARN' : 'PASS';
  const passed = !hasFail;
  const canProceed = !hasFail;

  // Calculate composite quality score (0 to 100)
  let score = 100;
  if (blurStatus === 'FAIL') score -= 50;
  else if (blurStatus === 'WARN') score -= 15;

  if (expStatus === 'FAIL') score -= 50;
  else if (expStatus === 'WARN') score -= 15;

  if (glareStatus === 'FAIL') score -= 50;
  else if (glareStatus === 'WARN') score -= 15;

  const qualityScore = Math.max(0, score);

  return {
    passed,
    canProceed,
    overallStatus,
    qualityScore,
    blurVariance,
    meanLuminance,
    glarePercent,
    items,
    reasons,
  };
}
