/**
 * Color Space Conversions
 *
 * XYZ to RGB and other color format conversions
 */

import type { XYZColor } from '../types/spectrum';

/**
 * sRGB color matrix (D65 illuminant)
 * Converts XYZ to linear RGB
 */
const XYZ_TO_SRGB_MATRIX = [
  [3.2406, -1.5372, -0.4986],
  [-0.9689, 1.8758, 0.0415],
  [0.0557, -0.2040, 1.0570],
];

/**
 * Apply sRGB gamma correction
 * Linear RGB to sRGB
 */
function srgbGamma(linear: number): number {
  if (linear <= 0.0031308) {
    return 12.92 * linear;
  }
  return 1.055 * Math.pow(linear, 1 / 2.4) - 0.055;
}

/**
 * Clamp a value between 0 and 1
 */
function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * Convert XYZ to sRGB
 * Note: XYZ values are expected to be in range 0-100 (Y normalized to 100)
 *
 * @param xyz XYZ color (Y normalized to 100)
 * @returns RGB values in range 0-255
 */
export function xyzToRGB(xyz: XYZColor): { r: number; g: number; b: number } {
  // Normalize XYZ (convert from 0-100 to 0-1 range)
  const X = xyz.X / 100;
  const Y = xyz.Y / 100;
  const Z = xyz.Z / 100;

  // Matrix multiplication
  const linearR = XYZ_TO_SRGB_MATRIX[0][0] * X + XYZ_TO_SRGB_MATRIX[0][1] * Y + XYZ_TO_SRGB_MATRIX[0][2] * Z;
  const linearG = XYZ_TO_SRGB_MATRIX[1][0] * X + XYZ_TO_SRGB_MATRIX[1][1] * Y + XYZ_TO_SRGB_MATRIX[1][2] * Z;
  const linearB = XYZ_TO_SRGB_MATRIX[2][0] * X + XYZ_TO_SRGB_MATRIX[2][1] * Y + XYZ_TO_SRGB_MATRIX[2][2] * Z;

  // Apply gamma and clamp
  const r = Math.round(clamp01(srgbGamma(linearR)) * 255);
  const g = Math.round(clamp01(srgbGamma(linearG)) * 255);
  const b = Math.round(clamp01(srgbGamma(linearB)) * 255);

  return { r, g, b };
}

/**
 * Convert RGB to hex color string
 */
export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (value: number) => {
    const hex = Math.round(clamp01(value / 255) * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

/**
 * Convert XYZ to hex color string
 */
export function xyzToHex(xyz: XYZColor): string {
  const { r, g, b } = xyzToRGB(xyz);
  return rgbToHex(r, g, b);
}

/**
 * Check if a color is within sRGB gamut
 * Returns true if the XYZ color maps to valid sRGB values (0-1 range)
 */
export function isInSRGBGamut(xyz: XYZColor): boolean {
  const X = xyz.X / 100;
  const Y = xyz.Y / 100;
  const Z = xyz.Z / 100;

  const linearR = XYZ_TO_SRGB_MATRIX[0][0] * X + XYZ_TO_SRGB_MATRIX[0][1] * Y + XYZ_TO_SRGB_MATRIX[0][2] * Z;
  const linearG = XYZ_TO_SRGB_MATRIX[1][0] * X + XYZ_TO_SRGB_MATRIX[1][1] * Y + XYZ_TO_SRGB_MATRIX[1][2] * Z;
  const linearB = XYZ_TO_SRGB_MATRIX[2][0] * X + XYZ_TO_SRGB_MATRIX[2][1] * Y + XYZ_TO_SRGB_MATRIX[2][2] * Z;

  const tolerance = 0.001; // Small tolerance for floating point errors
  return (
    linearR >= -tolerance && linearR <= 1 + tolerance &&
    linearG >= -tolerance && linearG <= 1 + tolerance &&
    linearB >= -tolerance && linearB <= 1 + tolerance
  );
}

/**
 * Get a displayable color, clipping out-of-gamut colors to gamut boundary
 */
export function getDisplayableColor(xyz: XYZColor): string {
  const { r, g, b } = xyzToRGB(xyz);
  return rgbToHex(r, g, b);
}
