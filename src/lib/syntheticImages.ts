/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface PatchCoordinates {
  name: 'white' | 'mid-grey' | 'black' | 'red' | 'green' | 'blue';
  x: number;
  y: number;
  width: number;
  height: number;
  targetRgb: [number, number, number];
}

export interface SyntheticImageResult {
  dataUrl: string;
  blob: Blob;
  width: number;
  height: number;
  sampleRegion: { x: number; y: number; width: number; height: number };
  patches: PatchCoordinates[];
  description: string;
}

export type SyntheticPreset =
  | 'cobalt-positive-warm'
  | 'cobalt-negative-warm'
  | 'marquis-positive-neutral'
  | 'duquenois-positive-warm'
  | 'defect-blurry'
  | 'defect-glare'
  | 'defect-underexposed';

// Ground-truth known sRGB values for the 6 card patches
export const STANDARD_PATCH_SRGB: Record<string, [number, number, number]> = {
  white: [240, 240, 240],
  'mid-grey': [128, 128, 128],
  black: [32, 32, 32],
  red: [210, 48, 48],
  green: [48, 168, 72],
  blue: [38, 92, 215],
};

/**
 * Generates a synthetic photo of a calibration reference card and test sample
 * with realistic color casts, glare, or blur for training and field demonstration.
 */
export async function generateSyntheticTestImage(
  preset: SyntheticPreset = 'cobalt-positive-warm'
): Promise<SyntheticImageResult> {
  const width = 800;
  const height = 600;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not acquire 2D canvas context');

  // Background: textured law enforcement patrol hood or bench
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  if (preset === 'defect-underexposed') {
    bgGrad.addColorStop(0, '#0a0d14');
    bgGrad.addColorStop(1, '#05070a');
  } else {
    bgGrad.addColorStop(0, '#1e2430');
    bgGrad.addColorStop(1, '#11151c');
  }
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Subtle table texture noise
  for (let i = 0; i < 4000; i++) {
    const nx = Math.random() * width;
    const ny = Math.random() * height;
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.04)';
    ctx.fillRect(nx, ny, 2, 2);
  }

  // Card Dimensions & Position
  const cardX = 60;
  const cardY = 80;
  const cardW = 420;
  const cardH = 440;

  // Draw card drop shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetX = 6;
  ctx.shadowOffsetY = 10;

  // Base White/Matte Calibration Card
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, 12);
  ctx.fill();

  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // Card Border & Title
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Fiducial Markers / Corner Crosshairs (Designed for future ArUco compatibility)
  const drawCornerReticle = (cx: number, cy: number) => {
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    ctx.strokeRect(cx - 14, cy - 14, 28, 28);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(cx - 6, cy - 6, 12, 12);
  };

  drawCornerReticle(cardX + 24, cardY + 24);
  drawCornerReticle(cardX + cardW - 24, cardY + 24);
  drawCornerReticle(cardX + 24, cardY + cardH - 24);
  drawCornerReticle(cardX + cardW - 24, cardY + cardH - 24);

  // Card Header Text
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText('FIELDTEST CALIBRATION STANDARD v1', cardX + 54, cardY + 28);
  ctx.font = '10px system-ui, sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.fillText('COLORIMETRIC NORMALIZATION REFERENCE - 6 PATCH', cardX + 54, cardY + 42);

  // Define the 6 Patch Positions on the Card
  const patchW = 100;
  const patchH = 80;
  const col1X = cardX + 60;
  const col2X = cardX + 260;
  const row1Y = cardY + 70;
  const row2Y = cardY + 185;
  const row3Y = cardY + 300;

  const patches: PatchCoordinates[] = [
    { name: 'white', x: col1X, y: row1Y, width: patchW, height: patchH, targetRgb: STANDARD_PATCH_SRGB.white },
    { name: 'mid-grey', x: col1X, y: row2Y, width: patchW, height: patchH, targetRgb: STANDARD_PATCH_SRGB['mid-grey'] },
    { name: 'black', x: col1X, y: row3Y, width: patchW, height: patchH, targetRgb: STANDARD_PATCH_SRGB.black },
    { name: 'red', x: col2X, y: row1Y, width: patchW, height: patchH, targetRgb: STANDARD_PATCH_SRGB.red },
    { name: 'green', x: col2X, y: row2Y, width: patchW, height: patchH, targetRgb: STANDARD_PATCH_SRGB.green },
    { name: 'blue', x: col2X, y: row3Y, width: patchW, height: patchH, targetRgb: STANDARD_PATCH_SRGB.blue },
  ];

  // Draw the 6 calibration patches
  for (const patch of patches) {
    // Thin patch border
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    ctx.strokeRect(patch.x - 1, patch.y - 1, patch.width + 2, patch.height + 2);

    // Patch fill
    const [r, g, b] = patch.targetRgb;
    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    ctx.fillRect(patch.x, patch.y, patch.width, patch.height);

    // Label
    ctx.fillStyle = patch.name === 'white' ? '#475569' : '#ffffff';
    ctx.font = 'bold 10px monospace';
    ctx.fillText(patch.name.toUpperCase(), patch.x + 8, patch.y + patch.height - 8);
  }

  // Sample Area (Positioned alongside card)
  const sampleX = 540;
  const sampleY = 160;
  const sampleW = 200;
  const sampleH = 280;

  // Sample Reagent Ampoule / Vial Holder
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.roundRect(sampleX - 10, sampleY - 10, sampleW + 20, sampleH + 20, 16);
  ctx.fill();
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Sample Header
  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.fillText('TEST SAMPLE AMPOULE', sampleX + 15, sampleY + 16);

  // Ampoule Glass Body
  const glassX = sampleX + 30;
  const glassY = sampleY + 40;
  const glassW = sampleW - 60;
  const glassH = sampleH - 70;

  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.beginPath();
  ctx.roundRect(glassX, glassY, glassW, glassH, 14);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Reagent Sample Color in Lower Well
  let sampleRgb: [number, number, number] = [18, 70, 205]; // Default Cobalt Blue Positive
  let presetDesc = 'Cobalt Thiocyanate Positive (Cocaine indication) under 2900K street lamp';

  if (preset === 'cobalt-negative-warm') {
    sampleRgb = [232, 165, 178]; // Pinkish unreacted
    presetDesc = 'Cobalt Thiocyanate Negative (Unreacted pink) under 2900K street lamp';
  } else if (preset === 'marquis-positive-neutral') {
    sampleRgb = [78, 18, 115]; // Deep Purple Marquis
    presetDesc = 'Marquis Reagent Positive (Opiates purple) in neutral lighting';
  } else if (preset === 'duquenois-positive-warm') {
    sampleRgb = [55, 40, 145]; // Violet THC layer
    presetDesc = 'Duquenois-Levine Positive (THC violet layer) under warm lighting';
  } else if (preset === 'defect-blurry') {
    sampleRgb = [18, 70, 205];
    presetDesc = 'Defect Test: Out-of-focus blur (Triggers Laplacian gate failure)';
  } else if (preset === 'defect-glare') {
    sampleRgb = [18, 70, 205];
    presetDesc = 'Defect Test: Direct flash glare reflection (Triggers Glare gate failure)';
  } else if (preset === 'defect-underexposed') {
    sampleRgb = [8, 30, 90];
    presetDesc = 'Defect Test: Low light / Under-exposed (Triggers Luminance gate failure)';
  }

  // Reaction Liquid fill in the vial
  const liquidY = glassY + glassH * 0.45;
  const liquidH = glassH * 0.55;

  const liquidGrad = ctx.createLinearGradient(glassX, liquidY, glassX + glassW, liquidY + liquidH);
  liquidGrad.addColorStop(0, `rgb(${sampleRgb[0]}, ${sampleRgb[1]}, ${sampleRgb[2]})`);
  liquidGrad.addColorStop(1, `rgb(${Math.max(0, sampleRgb[0] - 25)}, ${Math.max(0, sampleRgb[1] - 25)}, ${Math.max(0, sampleRgb[2] - 25)})`);

  ctx.fillStyle = liquidGrad;
  ctx.beginPath();
  ctx.roundRect(glassX + 3, liquidY, glassW - 6, liquidH - 3, [0, 0, 12, 12]);
  ctx.fill();

  // Glass meniscus & reflection highlights
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(glassX + 6, liquidY);
  ctx.quadraticCurveTo(glassX + glassW / 2, liquidY + 4, glassX + glassW - 6, liquidY);
  ctx.stroke();

  // Specular Glare Flare Defect
  if (preset === 'defect-glare') {
    // Saturated glare blowout directly across sample
    const glareX = glassX + glassW * 0.45;
    const glareY = liquidY + liquidH * 0.4;
    const rad = ctx.createRadialGradient(glareX, glareY, 0, glareX, glareY, 55);
    rad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
    rad.addColorStop(0.35, 'rgba(255, 255, 255, 0.95)');
    rad.addColorStop(0.7, 'rgba(255, 255, 255, 0.4)');
    rad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');

    ctx.fillStyle = rad;
    ctx.beginPath();
    ctx.arc(glareX, glareY, 55, 0, Math.PI * 2);
    ctx.fill();
  }

  // Apply Lighting Casts & Quality Defects to Entire Canvas Image
  const imgData = ctx.getImageData(0, 0, width, height);
  const d = imgData.data;

  // Deliberate warm tungsten / street light cast: Boost Red & Green, attenuate Blue
  const warmMultiplier: [number, number, number] =
    preset === 'marquis-positive-neutral'
      ? [1.02, 1.0, 0.98] // near neutral
      : [1.28, 1.06, 0.72]; // warm 2800K street lamp

  for (let i = 0; i < d.length; i += 4) {
    if (preset === 'defect-underexposed') {
      // Under-exposure: crush luminance by 70%
      d[i] = Math.min(255, d[i] * 0.28);
      d[i + 1] = Math.min(255, d[i + 1] * 0.28);
      d[i + 2] = Math.min(255, d[i + 2] * 0.25);
    } else {
      // Apply color cast
      d[i] = Math.min(255, d[i] * warmMultiplier[0]);
      d[i + 1] = Math.min(255, d[i + 1] * warmMultiplier[1]);
      d[i + 2] = Math.min(255, d[i + 2] * warmMultiplier[2]);
    }
  }

  // Put colored pixels back
  ctx.putImageData(imgData, 0, 0);

  // Apply intentional motion / defocus blur for the blur defect
  if (preset === 'defect-blurry') {
    ctx.filter = 'blur(9px)';
    ctx.drawImage(canvas, 0, 0);
    ctx.filter = 'none';
  }

  // Return synthetic result
  const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
  const blob = await new Promise<Blob>((resolve) => {
    canvas.toBlob((b) => resolve(b || new Blob()), 'image/jpeg', 0.92);
  });

  return {
    dataUrl,
    blob,
    width,
    height,
    sampleRegion: {
      x: glassX,
      y: liquidY,
      width: glassW,
      height: liquidH,
    },
    patches,
    description: presetDesc,
  };
}

/**
 * Generates an isolated photo of just the reagent chemical test sample
 * (ampoule / pouch / well) with ambient lighting cast.
 */
export async function generateSyntheticSampleImage(
  preset: SyntheticPreset = 'cobalt-positive-warm'
): Promise<{ dataUrl: string; blob: Blob; sampleMarker: { x: number; y: number; radius: number } }> {
  const width = 800;
  const height = 600;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not acquire 2D canvas context');

  // Background bench / evidence table
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  if (preset === 'defect-underexposed') {
    bgGrad.addColorStop(0, '#090b10');
    bgGrad.addColorStop(1, '#040507');
  } else {
    bgGrad.addColorStop(0, '#1c222c');
    bgGrad.addColorStop(1, '#0e1218');
  }
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Bench texture
  for (let i = 0; i < 3000; i++) {
    const nx = Math.random() * width;
    const ny = Math.random() * height;
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.05)';
    ctx.fillRect(nx, ny, 2, 2);
  }

  // Centered Reagent Pouch / Reaction Well
  const pouchX = 260;
  const pouchY = 100;
  const pouchW = 280;
  const pouchH = 400;

  // Drop shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetX = 4;
  ctx.shadowOffsetY = 12;

  // Clear plastic pouch background
  ctx.fillStyle = 'rgba(230, 240, 255, 0.15)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(pouchX, pouchY, pouchW, pouchH, 20);
  ctx.fill();
  ctx.stroke();

  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;

  // Pouch seal heat line
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.fillRect(pouchX + 15, pouchY + 25, pouchW - 30, 8);

  // Chemical reagent liquid pocket
  const liquidX = pouchX + 40;
  const liquidY = pouchY + 140;
  const liquidW = pouchW - 80;
  const liquidH = pouchH - 200;

  let liquidColor = '#2563eb'; // Cobalt blue default
  if (preset === 'cobalt-negative-warm') liquidColor = '#f43f5e'; // Pink unreacted
  if (preset === 'marquis-positive-neutral') liquidColor = '#581c87'; // Purple-black
  if (preset === 'duquenois-positive-warm') liquidColor = '#6b21a8'; // Indigo/violet

  const liquidGrad = ctx.createLinearGradient(liquidX, liquidY, liquidX, liquidY + liquidH);
  liquidGrad.addColorStop(0, liquidColor);
  liquidGrad.addColorStop(1, '#0f172a');

  ctx.fillStyle = liquidGrad;
  ctx.beginPath();
  ctx.roundRect(liquidX, liquidY, liquidW, liquidH, 16);
  ctx.fill();

  // Glass/Plastic reflection highlight
  const reflGrad = ctx.createLinearGradient(liquidX, liquidY, liquidX + 30, liquidY);
  reflGrad.addColorStop(0, 'rgba(255, 255, 255, 0.5)');
  reflGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = reflGrad;
  ctx.fillRect(liquidX + 5, liquidY + 5, 25, liquidH - 10);

  // Specular glare defect
  if (preset === 'defect-glare') {
    const glareGrad = ctx.createRadialGradient(
      liquidX + liquidW / 2,
      liquidY + liquidH / 2,
      4,
      liquidX + liquidW / 2,
      liquidY + liquidH / 2,
      90
    );
    glareGrad.addColorStop(0, 'rgba(255, 255, 255, 0.98)');
    glareGrad.addColorStop(0.3, 'rgba(255, 255, 255, 0.9)');
    glareGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = glareGrad;
    ctx.fillRect(0, 0, width, height);
  }

  // Label
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('CHEMICAL REAGENT SAMPLE', width / 2, pouchY + 65);
  ctx.font = '11px sans-serif';
  ctx.fillText('Reaction Zone - Ampoule Crushed', width / 2, pouchY + 85);

  // Apply Lighting Cast
  const imgData = ctx.getImageData(0, 0, width, height);
  const d = imgData.data;
  const warmMultiplier: [number, number, number] =
    preset === 'marquis-positive-neutral'
      ? [1.02, 1.0, 0.98]
      : [1.28, 1.06, 0.72];

  for (let i = 0; i < d.length; i += 4) {
    if (preset === 'defect-underexposed') {
      d[i] = Math.min(255, d[i] * 0.28);
      d[i + 1] = Math.min(255, d[i + 1] * 0.28);
      d[i + 2] = Math.min(255, d[i + 2] * 0.25);
    } else {
      d[i] = Math.min(255, d[i] * warmMultiplier[0]);
      d[i + 1] = Math.min(255, d[i + 1] * warmMultiplier[1]);
      d[i + 2] = Math.min(255, d[i + 2] * warmMultiplier[2]);
    }
  }
  ctx.putImageData(imgData, 0, 0);

  if (preset === 'defect-blurry') {
    ctx.filter = 'blur(9px)';
    ctx.drawImage(canvas, 0, 0);
    ctx.filter = 'none';
  }

  const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
  const blob = await new Promise<Blob>((resolve) => {
    canvas.toBlob((b) => resolve(b || new Blob()), 'image/jpeg', 0.92);
  });

  return {
    dataUrl,
    blob,
    sampleMarker: {
      x: Math.round(liquidX + liquidW / 2),
      y: Math.round(liquidY + liquidH / 2),
      radius: 35,
    },
  };
}

/**
 * Generates an isolated photo of just the 6-patch color reference card
 * with matching ambient lighting cast.
 */
export async function generateSyntheticReferenceCardImage(
  preset: SyntheticPreset = 'cobalt-positive-warm'
): Promise<{
  dataUrl: string;
  blob: Blob;
  patches: { name: string; x: number; y: number; radius: number }[];
}> {
  const width = 800;
  const height = 600;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not acquire 2D canvas context');

  // Background
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  if (preset === 'defect-underexposed') {
    bgGrad.addColorStop(0, '#090b10');
    bgGrad.addColorStop(1, '#040507');
  } else {
    bgGrad.addColorStop(0, '#1c222c');
    bgGrad.addColorStop(1, '#0e1218');
  }
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Centered Reference Card
  const cardX = 140;
  const cardY = 60;
  const cardW = 520;
  const cardH = 480;

  // Shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
  ctx.shadowBlur = 20;
  ctx.shadowOffsetX = 4;
  ctx.shadowOffsetY = 10;

  // Card Body
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, 16);
  ctx.fill();

  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;

  // Card Header & Grid
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 15px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('COLOR CALIBRATION CARD (6-PATCH)', width / 2, cardY + 38);
  ctx.font = '11px sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.fillText('NIST-Traceable sRGB Reference Standard', width / 2, cardY + 56);

  // Fiducial crosshairs in 4 corners
  const corners = [
    { x: cardX + 25, y: cardY + 25 },
    { x: cardX + cardW - 25, y: cardY + 25 },
    { x: cardX + 25, y: cardY + cardH - 25 },
    { x: cardX + cardW - 25, y: cardY + cardH - 25 },
  ];
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2.5;
  for (const c of corners) {
    ctx.beginPath();
    ctx.arc(c.x, c.y, 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(c.x - 14, c.y);
    ctx.lineTo(c.x + 14, c.y);
    ctx.moveTo(c.x, c.y - 14);
    ctx.lineTo(c.x, c.y + 14);
    ctx.stroke();
  }

  // Draw 6 patches in 2 columns x 3 rows
  const col1X = cardX + 50;
  const col2X = cardX + cardW / 2 + 20;
  const patchW = 190;
  const patchH = 95;
  const rowStartY = cardY + 80;
  const rowSpacing = 115;

  const patchSpecs = [
    { name: 'white', col: col1X, row: 0, srgb: STANDARD_PATCH_SRGB.white, label: 'WHITE (95%)' },
    { name: 'mid-grey', col: col1X, row: 1, srgb: STANDARD_PATCH_SRGB['mid-grey'], label: 'MID-GREY (18%)' },
    { name: 'black', col: col1X, row: 2, srgb: STANDARD_PATCH_SRGB.black, label: 'BLACK (2%)' },
    { name: 'red', col: col2X, row: 0, srgb: STANDARD_PATCH_SRGB.red, label: 'RED CHROMA' },
    { name: 'green', col: col2X, row: 1, srgb: STANDARD_PATCH_SRGB.green, label: 'GREEN CHROMA' },
    { name: 'blue', col: col2X, row: 2, srgb: STANDARD_PATCH_SRGB.blue, label: 'BLUE CHROMA' },
  ];

  const patchMarkers: { name: string; x: number; y: number; radius: number }[] = [];

  for (const p of patchSpecs) {
    const py = rowStartY + p.row * rowSpacing;
    ctx.fillStyle = `rgb(${p.srgb[0]}, ${p.srgb[1]}, ${p.srgb[2]})`;
    ctx.beginPath();
    ctx.roundRect(p.col, py, patchW, patchH, 8);
    ctx.fill();

    // Border
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Patch label
    ctx.fillStyle = p.name === 'white' ? '#475569' : '#ffffff';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(p.label, p.col + 8, py + 18);

    patchMarkers.push({
      name: p.name,
      x: Math.round(p.col + patchW / 2),
      y: Math.round(py + patchH / 2),
      radius: 30,
    });
  }

  // Apply Lighting Cast
  const imgData = ctx.getImageData(0, 0, width, height);
  const d = imgData.data;
  const warmMultiplier: [number, number, number] =
    preset === 'marquis-positive-neutral'
      ? [1.02, 1.0, 0.98]
      : [1.28, 1.06, 0.72];

  for (let i = 0; i < d.length; i += 4) {
    if (preset === 'defect-underexposed') {
      d[i] = Math.min(255, d[i] * 0.28);
      d[i + 1] = Math.min(255, d[i + 1] * 0.28);
      d[i + 2] = Math.min(255, d[i + 2] * 0.25);
    } else {
      d[i] = Math.min(255, d[i] * warmMultiplier[0]);
      d[i + 1] = Math.min(255, d[i + 1] * warmMultiplier[1]);
      d[i + 2] = Math.min(255, d[i + 2] * warmMultiplier[2]);
    }
  }
  ctx.putImageData(imgData, 0, 0);

  if (preset === 'defect-blurry') {
    ctx.filter = 'blur(9px)';
    ctx.drawImage(canvas, 0, 0);
    ctx.filter = 'none';
  }

  const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
  const blob = await new Promise<Blob>((resolve) => {
    canvas.toBlob((b) => resolve(b || new Blob()), 'image/jpeg', 0.92);
  });

  return {
    dataUrl,
    blob,
    patches: patchMarkers,
  };
}

