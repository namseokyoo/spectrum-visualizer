/**
 * Chromaticity Coordinate Conversions
 *
 * Converts XYZ tristimulus values to various chromaticity coordinate systems
 */

import type { XYZColor, CIE1931Coordinates, CIE1976Coordinates } from '../types/spectrum';

/**
 * Convert XYZ to CIE 1931 xy chromaticity coordinates
 *
 * Formula:
 * x = X / (X + Y + Z)
 * y = Y / (X + Y + Z)
 */
export function xyzToXY(xyz: XYZColor): CIE1931Coordinates {
  const { X, Y, Z } = xyz;
  const sum = X + Y + Z;

  if (sum === 0) {
    return { x: 0.3127, y: 0.3290 }; // D65 white point as fallback
  }

  return {
    x: X / sum,
    y: Y / sum,
  };
}

/**
 * Convert XYZ to CIE 1976 u'v' chromaticity coordinates
 *
 * Formula:
 * u' = 4X / (X + 15Y + 3Z)
 * v' = 9Y / (X + 15Y + 3Z)
 */
export function xyzToUV(xyz: XYZColor): CIE1976Coordinates {
  const { X, Y, Z } = xyz;
  const denom = X + 15 * Y + 3 * Z;

  if (denom === 0) {
    return { u: 0.1978, v: 0.4683 }; // D65 white point in u'v' as fallback
  }

  return {
    u: (4 * X) / denom,
    v: (9 * Y) / denom,
  };
}

/**
 * Convert CIE 1931 xy to CIE 1976 u'v'
 *
 * Formula:
 * u' = 4x / (-2x + 12y + 3)
 * v' = 9y / (-2x + 12y + 3)
 */
export function xyToUV(xy: CIE1931Coordinates): CIE1976Coordinates {
  const { x, y } = xy;
  const denom = -2 * x + 12 * y + 3;

  if (denom === 0) {
    return { u: 0.1978, v: 0.4683 };
  }

  return {
    u: (4 * x) / denom,
    v: (9 * y) / denom,
  };
}

/**
 * Convert CIE 1976 u'v' to CIE 1931 xy
 *
 * Formula:
 * x = 9u' / (6u' - 16v' + 12)
 * y = 4v' / (6u' - 16v' + 12)
 */
export function uvToXY(uv: CIE1976Coordinates): CIE1931Coordinates {
  const { u, v } = uv;
  const denom = 6 * u - 16 * v + 12;

  if (denom === 0) {
    return { x: 0.3127, y: 0.3290 };
  }

  return {
    x: (9 * u) / denom,
    y: (4 * v) / denom,
  };
}

/**
 * Calculate color difference (Delta E) in CIE 1976 u'v' space
 * This is a simple Euclidean distance in u'v' space
 */
export function colorDifferenceUV(uv1: CIE1976Coordinates, uv2: CIE1976Coordinates): number {
  const du = uv1.u - uv2.u;
  const dv = uv1.v - uv2.v;
  return Math.sqrt(du * du + dv * dv);
}

/**
 * Check if a chromaticity coordinate is within a color gamut
 * Uses point-in-triangle test
 */
export function isInGamut(
  point: CIE1931Coordinates,
  gamutVertices: CIE1931Coordinates[]
): boolean {
  if (gamutVertices.length !== 3) {
    return false;
  }

  const [v1, v2, v3] = gamutVertices;

  // Barycentric coordinate method
  const denom = (v2.y - v3.y) * (v1.x - v3.x) + (v3.x - v2.x) * (v1.y - v3.y);

  const a = ((v2.y - v3.y) * (point.x - v3.x) + (v3.x - v2.x) * (point.y - v3.y)) / denom;
  const b = ((v3.y - v1.y) * (point.x - v3.x) + (v1.x - v3.x) * (point.y - v3.y)) / denom;
  const c = 1 - a - b;

  return a >= 0 && a <= 1 && b >= 0 && b <= 1 && c >= 0 && c <= 1;
}
