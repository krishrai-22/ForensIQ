/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

declare module 'culori' {
  export interface RgbColor {
    mode: 'rgb';
    r: number;
    g: number;
    b: number;
    alpha?: number;
  }

  export interface LabColor {
    mode: 'lab';
    l: number;
    a?: number;
    b?: number;
    alpha?: number;
  }

  export function rgb(color: string | RgbColor | LabColor): RgbColor;
  export function lab(color: string | RgbColor | LabColor): LabColor;
  export function differenceCiede2000(weights?: {
    kl?: number;
    kc?: number;
    kh?: number;
  }): (c1: LabColor | RgbColor, c2: LabColor | RgbColor) => number;
}
