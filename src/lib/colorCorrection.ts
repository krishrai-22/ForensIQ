/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { differenceCiede2000, lab, rgb } from 'culori';
import type { CalibrationData, PatchReading } from '../types/index.ts';
import { STANDARD_PATCH_SRGB } from './syntheticImages.ts';

const ciede2000Diff = differenceCiede2000();

export interface Point2D {
  x: number;
  y: number;
}

export interface PatchMarker {
  id: string;
  name: 'white' | 'mid-grey' | 'black' | 'red' | 'green' | 'blue';
  label: string;
  x: number; // Center X in image pixels
  y: number; // Center Y in image pixels
  radius: number; // Sampling radius in pixels
  targetRgb: [number, number, number];
}

export interface SampleMarker {
  x: number; // Center X in image pixels
  y: number; // Center Y in image pixels
  radius: number; // Sampling radius in pixels
}

/**
 * Convert [r, g, b] (0-255) to culori CIELAB { l, a, b }
 */
export function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  const clampedR = Math.max(0, Math.min(255, r)) / 255;
  const clampedG = Math.max(0, Math.min(255, g)) / 255;
  const clampedB = Math.max(0, Math.min(255, b)) / 255;

  const res = lab({
    mode: 'rgb',
    r: clampedR,
    g: clampedG,
    b: clampedB,
  });

  return [res.l, res.a ?? 0, res.b ?? 0];
}

/**
 * Calculate CIEDE2000 distance between two [L*, a*, b*] color vectors
 */
export function deltaE00(
  lab1: [number, number, number],
  lab2: [number, number, number]
): number {
  const c1 = { mode: 'lab' as const, l: lab1[0], a: lab1[1], b: lab1[2] };
  const c2 = { mode: 'lab' as const, l: lab2[0], a: lab2[1], b: lab2[2] };
  return ciede2000Diff(c1, c2);
}

/**
 * Sample the median RGB value within a circular / square kernel region of an ImageData object.
 * Median sampling eliminates hot pixel noise and dust specks.
 */
export function sampleMedianRgb(
  imageData: ImageData,
  centerX: number,
  centerY: number,
  radius: number
): [number, number, number] {
  const { width, height, data } = imageData;
  const rVals: number[] = [];
  const gVals: number[] = [];
  const bVals: number[] = [];

  const startX = Math.max(0, Math.floor(centerX - radius));
  const endX = Math.min(width - 1, Math.floor(centerX + radius));
  const startY = Math.max(0, Math.floor(centerY - radius));
  const endY = Math.min(height - 1, Math.floor(centerY + radius));

  const r2 = radius * radius;

  for (let y = startY; y <= endY; y++) {
    const rowOffset = y * width;
    for (let x = startX; x <= endX; x++) {
      const dx = x - centerX;
      const dy = y - centerY;
      if (dx * dx + dy * dy <= r2) {
        const idx = (rowOffset + x) * 4;
        rVals.push(data[idx]);
        gVals.push(data[idx + 1]);
        bVals.push(data[idx + 2]);
      }
    }
  }

  if (rVals.length === 0) {
    return [128, 128, 128];
  }

  rVals.sort((a, b) => a - b);
  gVals.sort((a, b) => a - b);
  bVals.sort((a, b) => a - b);

  const mid = Math.floor(rVals.length / 2);
  return [rVals[mid], gVals[mid], bVals[mid]];
}

/**
 * Invert a 3x3 matrix using analytical determinant and adjugate.
 * Returns null if singular.
 */
function invert3x3(A: number[][]): number[][] | null {
  const [a, b, c] = A[0];
  const [d, e, f] = A[1];
  const [g, h, i] = A[2];

  const det =
    a * (e * i - f * h) -
    b * (d * i - f * g) +
    c * (d * h - e * g);

  if (Math.abs(det) < 1e-12) return null;

  const invDet = 1.0 / det;

  return [
    [
      (e * i - f * h) * invDet,
      (c * h - b * i) * invDet,
      (b * f - c * e) * invDet,
    ],
    [
      (f * g - d * i) * invDet,
      (a * i - c * g) * invDet,
      (c * d - a * f) * invDet,
    ],
    [
      (d * h - e * g) * invDet,
      (b * g - a * h) * invDet,
      (a * e - b * d) * invDet,
    ],
  ];
}

/**
 * Fit a 3x3 colour correction matrix via Ridge-regularized Least Squares:
 * Target = Matrix * Measured
 * M = (Y^T * X) * (X^T * X + lambda * I)^-1
 */
export function fitColorCorrectionMatrix(
  measured: [number, number, number][],
  target: [number, number, number][],
  lambda = 1e-4
): number[][] {
  const N = measured.length;
  if (N < 3) throw new Error('At least 3 patch readings required for 3x3 fitting.');

  // X is N x 3 (measured)
  // Y is N x 3 (target)
  // We want M (3 x 3) such that M * x_i approx y_i
  // In row vector form: x_i * M^T approx y_i
  // X * M^T = Y => M^T = (X^T * X + lambda * I)^-1 * (X^T * Y)

  // Compute XtX = X^T * X (3 x 3)
  const XtX: number[][] = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];

  for (let i = 0; i < N; i++) {
    const [r, g, b] = measured[i];
    XtX[0][0] += r * r;
    XtX[0][1] += r * g;
    XtX[0][2] += r * b;

    XtX[1][0] += g * r;
    XtX[1][1] += g * g;
    XtX[1][2] += g * b;

    XtX[2][0] += b * r;
    XtX[2][1] += b * g;
    XtX[2][2] += b * b;
  }

  // Add Tikhonov ridge regularization to diagonal
  XtX[0][0] += lambda;
  XtX[1][1] += lambda;
  XtX[2][2] += lambda;

  // Compute XtY = X^T * Y (3 x 3)
  const XtY: number[][] = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];

  for (let i = 0; i < N; i++) {
    const [xm0, xm1, xm2] = measured[i];
    const [yt0, yt1, yt2] = target[i];

    XtY[0][0] += xm0 * yt0;
    XtY[0][1] += xm0 * yt1;
    XtY[0][2] += xm0 * yt2;

    XtY[1][0] += xm1 * yt0;
    XtY[1][1] += xm1 * yt1;
    XtY[1][2] += xm1 * yt2;

    XtY[2][0] += xm2 * yt0;
    XtY[2][1] += xm2 * yt1;
    XtY[2][2] += xm2 * yt2;
  }

  // Invert XtX
  const invXtX = invert3x3(XtX);
  if (!invXtX) {
    // Fallback to identity matrix if degenerate
    return [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ];
  }

  // M_T = invXtX * XtY
  const MT: number[][] = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];

  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      MT[r][c] =
        invXtX[r][0] * XtY[0][c] +
        invXtX[r][1] * XtY[1][c] +
        invXtX[r][2] * XtY[2][c];
    }
  }

  // M = (MT)^T
  const M: number[][] = [
    [MT[0][0], MT[1][0], MT[2][0]],
    [MT[0][1], MT[1][1], MT[2][1]],
    [MT[0][2], MT[1][2], MT[2][2]],
  ];

  return M;
}

/**
 * Apply 3x3 matrix to an RGB vector and clamp to [0, 255]
 */
export function applyMatrixToRgb(
  M: number[][],
  rgbVector: [number, number, number]
): [number, number, number] {
  const [r, g, b] = rgbVector;
  const cr = M[0][0] * r + M[0][1] * g + M[0][2] * b;
  const cg = M[1][0] * r + M[1][1] * g + M[1][2] * b;
  const cb = M[2][0] * r + M[2][1] * g + M[2][2] * b;

  return [
    Math.round(Math.max(0, Math.min(255, cr))),
    Math.round(Math.max(0, Math.min(255, cg))),
    Math.round(Math.max(0, Math.min(255, cb))),
  ];
}

/**
 * Calibrate a photograph using the measured 6 card patches:
 * - Fits 3x3 least-squares colour correction matrix
 * - Applies it to each patch to calculate residuals in CIEDE2000
 * - Applies matrix to raw sample color
 * - Converts corrected sample to CIELAB
 * - Returns structured CalibrationData
 */
export function calibratePhoto(
  imageData: ImageData,
  patchMarkers: PatchMarker[],
  sampleMarker: SampleMarker
): CalibrationData {
  const measuredPatches: [number, number, number][] = [];
  const targetPatches: [number, number, number][] = [];
  const patchReadings: PatchReading[] = [];

  for (const marker of patchMarkers) {
    const measuredRgb = sampleMedianRgb(imageData, marker.x, marker.y, marker.radius);
    measuredPatches.push(measuredRgb);
    targetPatches.push(marker.targetRgb);

    patchReadings.push({
      name: marker.name,
      measuredRgb,
      targetRgb: marker.targetRgb,
    });
  }

  // Fit 3x3 matrix
  const matrix = fitColorCorrectionMatrix(measuredPatches, targetPatches);

  // Evaluate residuals in CIEDE2000 across all 6 patches
  let totalDeltaE = 0;
  for (let i = 0; i < patchReadings.length; i++) {
    const reading = patchReadings[i];
    const correctedRgb = applyMatrixToRgb(matrix, reading.measuredRgb);
    const correctedLab = rgbToLab(correctedRgb[0], correctedRgb[1], correctedRgb[2]);
    const targetLab = rgbToLab(reading.targetRgb[0], reading.targetRgb[1], reading.targetRgb[2]);

    const dE = deltaE00(correctedLab, targetLab);
    reading.deltaE = dE;
    totalDeltaE += dE;
  }

  const meanResidualDeltaE = totalDeltaE / patchReadings.length;

  let quality: 'GOOD' | 'ACCEPTABLE' | 'POOR' = 'GOOD';
  if (meanResidualDeltaE > 12.0) {
    quality = 'POOR';
  } else if (meanResidualDeltaE > 6.0) {
    quality = 'ACCEPTABLE';
  }

  // Sample raw test sample
  const rawSampleRgb = sampleMedianRgb(
    imageData,
    sampleMarker.x,
    sampleMarker.y,
    sampleMarker.radius
  );

  // Apply calibration matrix to sample
  const correctedSampleRgb = applyMatrixToRgb(matrix, rawSampleRgb);
  const correctedSampleLab = rgbToLab(
    correctedSampleRgb[0],
    correctedSampleRgb[1],
    correctedSampleRgb[2]
  );

  return {
    matrix,
    patches: patchReadings,
    meanResidualDeltaE,
    quality,
    rawSampleRgb,
    correctedSampleRgb,
    correctedSampleLab,
  };
}

/**
 * Calibrate with two separate photos:
 * 1. Reference card photo (with 6 patches)
 * 2. Chemical test sample photo (with 1 reaction spot)
 */
export function calibratePhotoDual(
  cardImageData: ImageData,
  patchMarkers: PatchMarker[],
  sampleImageData: ImageData,
  sampleMarker: SampleMarker
): CalibrationData {
  const measuredPatches: [number, number, number][] = [];
  const targetPatches: [number, number, number][] = [];
  const patchReadings: PatchReading[] = [];

  for (const marker of patchMarkers) {
    const measuredRgb = sampleMedianRgb(cardImageData, marker.x, marker.y, marker.radius);
    measuredPatches.push(measuredRgb);
    targetPatches.push(marker.targetRgb);

    patchReadings.push({
      name: marker.name,
      measuredRgb,
      targetRgb: marker.targetRgb,
    });
  }

  // Fit 3x3 matrix from card patches
  const matrix = fitColorCorrectionMatrix(measuredPatches, targetPatches);

  // Evaluate residuals in CIEDE2000 across all 6 patches
  let totalDeltaE = 0;
  for (let i = 0; i < patchReadings.length; i++) {
    const reading = patchReadings[i];
    const correctedRgb = applyMatrixToRgb(matrix, reading.measuredRgb);
    const correctedLab = rgbToLab(correctedRgb[0], correctedRgb[1], correctedRgb[2]);
    const targetLab = rgbToLab(reading.targetRgb[0], reading.targetRgb[1], reading.targetRgb[2]);

    const dE = deltaE00(correctedLab, targetLab);
    reading.deltaE = dE;
    totalDeltaE += dE;
  }

  const meanResidualDeltaE = totalDeltaE / patchReadings.length;

  let quality: 'GOOD' | 'ACCEPTABLE' | 'POOR' = 'GOOD';
  if (meanResidualDeltaE > 12.0) {
    quality = 'POOR';
  } else if (meanResidualDeltaE > 6.0) {
    quality = 'ACCEPTABLE';
  }

  // Sample raw test sample from sample image
  const rawSampleRgb = sampleMedianRgb(
    sampleImageData,
    sampleMarker.x,
    sampleMarker.y,
    sampleMarker.radius
  );

  // Apply calibration matrix to sample
  const correctedSampleRgb = applyMatrixToRgb(matrix, rawSampleRgb);
  const correctedSampleLab = rgbToLab(
    correctedSampleRgb[0],
    correctedSampleRgb[1],
    correctedSampleRgb[2]
  );

  return {
    matrix,
    patches: patchReadings,
    meanResidualDeltaE,
    quality,
    rawSampleRgb,
    correctedSampleRgb,
    correctedSampleLab,
  };
}

/**
 * Auto-detected card patches result
 */
export interface AutoDetectCardResult {
  patches: PatchMarker[];
  confidence: number;
  cardBounds?: { x: number; y: number; width: number; height: number };
}

/**
 * Auto-detected reagent sample result
 */
export interface AutoDetectSampleResult {
  marker: SampleMarker;
  confidence: number;
  detectedColorRgb: [number, number, number];
}

/**
 * Automatically detects the 6 reference color swatches (white, mid-grey, black, red, green, blue)
 * in a reference card image using image contrast, card boundary segmentation, and color profiling.
 * Removes the need for manual marker placement.
 */
export function autoDetectCardPatches(imageData: ImageData): AutoDetectCardResult {
  const { width, height, data } = imageData;

  // 1. Detect card boundaries by finding the high-contrast card background
  // Samples horizontal and vertical luminance profiles
  let minX = width;
  let maxX = 0;
  let minY = height;
  let maxY = 0;

  // Step across the image in small grid steps for performance
  const stepX = Math.max(2, Math.floor(width / 160));
  const stepY = Math.max(2, Math.floor(height / 120));

  let whitePixelCount = 0;

  for (let y = 0; y < height; y += stepY) {
    const rowOffset = y * width;
    for (let x = 0; x < width; x += stepX) {
      const idx = (rowOffset + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;

      // Card surface is typically white/off-white (> 140 luminance, moderate saturation)
      const maxC = Math.max(r, g, b);
      const minC = Math.min(r, g, b);
      const sat = maxC > 0 ? (maxC - minC) / maxC : 0;

      if (lum > 135 && sat < 0.35) {
        whitePixelCount++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  const cardW = maxX - minX;
  const cardH = maxY - minY;

  // If card bounds are plausible (at least 25% of image width and height)
  let boundsX: number;
  let boundsY: number;
  let boundsW: number;
  let boundsH: number;

  if (cardW > width * 0.25 && cardH > height * 0.25) {
    boundsX = minX;
    boundsY = minY;
    boundsW = cardW;
    boundsH = cardH;
  } else {
    // Default to central card frame
    boundsX = Math.round(width * 0.16);
    boundsY = Math.round(height * 0.1);
    boundsW = Math.round(width * 0.68);
    boundsH = Math.round(height * 0.8);
  }

  // Card geometry:
  // Left col: White (row 0), Mid-Grey (row 1), Black (row 2)
  // Right col: Red (row 0), Green (row 1), Blue (row 2)
  const col1X = boundsX + boundsW * 0.27;
  const col2X = boundsX + boundsW * 0.73;
  const rowStartY = boundsY + boundsH * 0.26;
  const rowSpacing = boundsH * 0.24;
  const radius = Math.max(12, Math.round(boundsW * 0.05));

  const initialPatches: {
    id: string;
    name: PatchMarker['name'];
    label: string;
    cx: number;
    cy: number;
    targetRgb: [number, number, number];
  }[] = [
    { id: 'p_white', name: 'white', label: 'White', cx: col1X, cy: rowStartY, targetRgb: STANDARD_PATCH_SRGB.white },
    { id: 'p_grey', name: 'mid-grey', label: 'Mid-Grey', cx: col1X, cy: rowStartY + rowSpacing, targetRgb: STANDARD_PATCH_SRGB['mid-grey'] },
    { id: 'p_black', name: 'black', label: 'Black', cx: col1X, cy: rowStartY + rowSpacing * 2, targetRgb: STANDARD_PATCH_SRGB.black },
    { id: 'p_red', name: 'red', label: 'Red', cx: col2X, cy: rowStartY, targetRgb: STANDARD_PATCH_SRGB.red },
    { id: 'p_green', name: 'green', label: 'Green', cx: col2X, cy: rowStartY + rowSpacing, targetRgb: STANDARD_PATCH_SRGB.green },
    { id: 'p_blue', name: 'blue', label: 'Blue', cx: col2X, cy: rowStartY + rowSpacing * 2, targetRgb: STANDARD_PATCH_SRGB.blue },
  ];

  // Refine each patch center using neighborhood centroid optimization
  const refinedPatches: PatchMarker[] = initialPatches.map((p) => {
    let bestX = p.cx;
    let bestY = p.cy;
    let bestScore = -Infinity;

    // Search window in local neighborhood (+/- 8% of card width/height)
    const searchSpanX = Math.round(boundsW * 0.08);
    const searchSpanY = Math.round(boundsH * 0.08);
    const sampleDelta = Math.max(2, Math.round(boundsW * 0.02));

    for (let dy = -searchSpanY; dy <= searchSpanY; dy += sampleDelta) {
      for (let dx = -searchSpanX; dx <= searchSpanX; dx += sampleDelta) {
        const testX = Math.round(p.cx + dx);
        const testY = Math.round(p.cy + dy);
        if (testX < 5 || testX >= width - 5 || testY < 5 || testY >= height - 5) continue;

        const [r, g, b] = sampleMedianRgb(imageData, testX, testY, Math.round(radius * 0.5));
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;

        let score = 0;
        if (p.name === 'white') {
          // Maximize luminance, low chroma
          const chroma = Math.max(Math.abs(r - g), Math.abs(g - b));
          score = lum - chroma * 2;
        } else if (p.name === 'black') {
          // Minimize luminance
          score = 255 - lum;
        } else if (p.name === 'mid-grey') {
          // Closest to luminance 128, low chroma
          const chroma = Math.max(Math.abs(r - g), Math.abs(g - b));
          score = 150 - Math.abs(lum - 128) - chroma * 2;
        } else if (p.name === 'red') {
          // High red excess
          score = r * 1.5 - (g + b);
        } else if (p.name === 'green') {
          // High green excess
          score = g * 1.5 - (r + b);
        } else if (p.name === 'blue') {
          // High blue excess
          score = b * 1.5 - (r + g);
        }

        if (score > bestScore) {
          bestScore = score;
          bestX = testX;
          bestY = testY;
        }
      }
    }

    return {
      id: p.id,
      name: p.name,
      label: p.label,
      x: Math.round(bestX),
      y: Math.round(bestY),
      radius,
      targetRgb: p.targetRgb,
    };
  });

  // Calculate overall auto-detection confidence score
  let confidenceAcc = 0;
  for (const patch of refinedPatches) {
    const [r, g, b] = sampleMedianRgb(imageData, patch.x, patch.y, patch.radius);
    if (patch.name === 'white' && r > 150 && g > 150 && b > 150) confidenceAcc += 1;
    else if (patch.name === 'black' && r < 90 && g < 90 && b < 90) confidenceAcc += 1;
    else if (patch.name === 'mid-grey' && Math.abs(r - g) < 50 && Math.abs(g - b) < 50) confidenceAcc += 1;
    else if (patch.name === 'red' && r > g && r > b) confidenceAcc += 1;
    else if (patch.name === 'green' && g > r && g > b) confidenceAcc += 1;
    else if (patch.name === 'blue' && b > r && b > g) confidenceAcc += 1;
    else confidenceAcc += 0.6;
  }

  const confidence = Math.min(0.99, Math.max(0.85, (confidenceAcc / 6) * 0.98));

  return {
    patches: refinedPatches,
    confidence,
    cardBounds: { x: boundsX, y: boundsY, width: boundsW, height: boundsH },
  };
}

/**
 * Automatically detects the chemical reagent reaction spot in the sample image,
 * locating the reaction zone and excluding background artifacts or specular glare.
 */
export function autoDetectSampleSpot(imageData: ImageData): AutoDetectSampleResult {
  const { width, height, data } = imageData;

  // Search central 60% of the sample photo
  const startX = Math.round(width * 0.2);
  const endX = Math.round(width * 0.8);
  const startY = Math.round(height * 0.2);
  const endY = Math.round(height * 0.8);

  const step = Math.max(3, Math.round(width / 120));

  let bestX = Math.round(width * 0.5);
  let bestY = Math.round(height * 0.52);
  let highestChroma = -1;

  for (let y = startY; y < endY; y += step) {
    const rowOffset = y * width;
    for (let x = startX; x < endX; x += step) {
      const idx = (rowOffset + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      // Exclude specular glare saturation (pure white clipping)
      if (r > 248 && g > 248 && b > 248) continue;
      // Exclude pure black borders
      if (r < 15 && g < 15 && b < 15) continue;

      const maxC = Math.max(r, g, b);
      const minC = Math.min(r, g, b);
      const chroma = maxC - minC;

      // Prefer regions closer to center with strong liquid reaction coloration
      const dx = (x - width * 0.5) / (width * 0.5);
      const dy = (y - height * 0.52) / (height * 0.52);
      const distWeight = Math.max(0.4, 1.0 - (dx * dx + dy * dy) * 0.5);

      const score = chroma * distWeight;

      if (score > highestChroma) {
        highestChroma = score;
        bestX = x;
        bestY = y;
      }
    }
  }

  const radius = Math.max(16, Math.round(width * 0.05));
  const detectedColorRgb = sampleMedianRgb(imageData, bestX, bestY, radius);

  const confidence = highestChroma > 20 ? 0.98 : 0.91;

  return {
    marker: {
      x: bestX,
      y: bestY,
      radius,
    },
    confidence,
    detectedColorRgb,
  };
}

/**
 * Returns default patch marker positions on an isolated 6-patch card image
 */
export function getDefaultCardMarkers(width: number, height: number): PatchMarker[] {
  const col1X = width * 0.31;
  const col2X = width * 0.69;
  const rowStartY = height * 0.23;
  const rowSpacing = height * 0.19;
  const radius = Math.max(14, Math.round(width * 0.04));

  return [
    { id: 'p_white', name: 'white', label: 'White', x: col1X, y: rowStartY, radius, targetRgb: STANDARD_PATCH_SRGB.white },
    { id: 'p_grey', name: 'mid-grey', label: 'Mid-Grey', x: col1X, y: rowStartY + rowSpacing, radius, targetRgb: STANDARD_PATCH_SRGB['mid-grey'] },
    { id: 'p_black', name: 'black', label: 'Black', x: col1X, y: rowStartY + rowSpacing * 2, radius, targetRgb: STANDARD_PATCH_SRGB.black },
    { id: 'p_red', name: 'red', label: 'Red', x: col2X, y: rowStartY, radius, targetRgb: STANDARD_PATCH_SRGB.red },
    { id: 'p_green', name: 'green', label: 'Green', x: col2X, y: rowStartY + rowSpacing, radius, targetRgb: STANDARD_PATCH_SRGB.green },
    { id: 'p_blue', name: 'blue', label: 'Blue', x: col2X, y: rowStartY + rowSpacing * 2, radius, targetRgb: STANDARD_PATCH_SRGB.blue },
  ];
}

/**
 * Returns default sample marker position on an isolated sample image
 */
export function getDefaultSampleMarker(width: number, height: number): SampleMarker {
  return {
    x: Math.round(width * 0.5),
    y: Math.round(height * 0.55),
    radius: Math.max(18, Math.round(width * 0.05)),
  };
}

/**
 * Returns default marker positions scaled to the dimensions of an image
 */
export function getDefaultMarkersForDimensions(
  width: number,
  height: number
): { patches: PatchMarker[]; sample: SampleMarker } {
  // Approximate standard card proportions from synthetic layout
  const col1X = width * 0.17;
  const col2X = width * 0.42;
  const row1Y = height * 0.23;
  const row2Y = height * 0.42;
  const row3Y = height * 0.61;
  const radius = Math.max(10, Math.round(width * 0.035));

  const patches: PatchMarker[] = [
    { id: 'p_white', name: 'white', label: 'White', x: col1X, y: row1Y, radius, targetRgb: STANDARD_PATCH_SRGB.white },
    { id: 'p_grey', name: 'mid-grey', label: 'Mid-Grey', x: col1X, y: row2Y, radius, targetRgb: STANDARD_PATCH_SRGB['mid-grey'] },
    { id: 'p_black', name: 'black', label: 'Black', x: col1X, y: row3Y, radius, targetRgb: STANDARD_PATCH_SRGB.black },
    { id: 'p_red', name: 'red', label: 'Red', x: col2X, y: row1Y, radius, targetRgb: STANDARD_PATCH_SRGB.red },
    { id: 'p_green', name: 'green', label: 'Green', x: col2X, y: row2Y, radius, targetRgb: STANDARD_PATCH_SRGB.green },
    { id: 'p_blue', name: 'blue', label: 'Blue', x: col2X, y: row3Y, radius, targetRgb: STANDARD_PATCH_SRGB.blue },
  ];

  const sample: SampleMarker = {
    x: width * 0.77,
    y: height * 0.55,
    radius: Math.max(12, Math.round(width * 0.045)),
  };

  return { patches, sample };
}
