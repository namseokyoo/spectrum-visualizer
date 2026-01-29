/**
 * Spectrum to XYZ Conversion
 *
 * Converts emission spectrum data to CIE XYZ tristimulus values
 * using CIE 1931 2-degree Standard Observer functions.
 */

import { CIE1931_OBSERVER } from '../data/cie1931';
import type { SpectrumPoint, XYZColor } from '../types/spectrum';

/**
 * Interpolate CIE observer function value at a specific wavelength
 * Uses linear interpolation between 5nm data points
 */
function interpolateObserver(wavelength: number, component: 'x' | 'y' | 'z'): number {
  if (wavelength < 380 || wavelength > 780) {
    return 0;
  }

  const index = (wavelength - 380) / 5;
  const lowerIndex = Math.floor(index);
  const upperIndex = Math.ceil(index);

  if (lowerIndex === upperIndex || upperIndex >= CIE1931_OBSERVER.length) {
    return CIE1931_OBSERVER[Math.min(lowerIndex, CIE1931_OBSERVER.length - 1)][component];
  }

  const t = index - lowerIndex;
  const lower = CIE1931_OBSERVER[lowerIndex][component];
  const upper = CIE1931_OBSERVER[upperIndex][component];

  return lower + t * (upper - lower);
}

/**
 * Convert spectrum data to CIE XYZ tristimulus values
 *
 * Formula:
 * X = k * Integral[S(lambda) * x_bar(lambda) * d_lambda]
 * Y = k * Integral[S(lambda) * y_bar(lambda) * d_lambda]
 * Z = k * Integral[S(lambda) * z_bar(lambda) * d_lambda]
 *
 * where k is a normalization constant (typically set so Y = 100 for reference white)
 *
 * @param spectrum Array of spectrum points (wavelength, intensity)
 * @param normalize Whether to normalize the result (default: true)
 * @returns XYZ tristimulus values
 */
export function spectrumToXYZ(spectrum: SpectrumPoint[], normalize: boolean = true): XYZColor {
  let X = 0;
  let Y = 0;
  let Z = 0;

  // Sort spectrum by wavelength
  const sorted = [...spectrum].sort((a, b) => a.wavelength - b.wavelength);

  // Integrate using trapezoidal rule
  for (let i = 0; i < sorted.length - 1; i++) {
    const lambda1 = sorted[i].wavelength;
    const lambda2 = sorted[i + 1].wavelength;
    const intensity1 = sorted[i].intensity;
    const intensity2 = sorted[i + 1].intensity;

    const dLambda = lambda2 - lambda1;

    // Get observer values at both wavelengths
    const x1 = interpolateObserver(lambda1, 'x');
    const x2 = interpolateObserver(lambda2, 'x');
    const y1 = interpolateObserver(lambda1, 'y');
    const y2 = interpolateObserver(lambda2, 'y');
    const z1 = interpolateObserver(lambda1, 'z');
    const z2 = interpolateObserver(lambda2, 'z');

    // Trapezoidal integration
    X += 0.5 * (intensity1 * x1 + intensity2 * x2) * dLambda;
    Y += 0.5 * (intensity1 * y1 + intensity2 * y2) * dLambda;
    Z += 0.5 * (intensity1 * z1 + intensity2 * z2) * dLambda;
  }

  // Normalize if requested
  if (normalize && Y > 0) {
    const k = 100 / Y;  // Normalize so Y = 100
    X *= k;
    Y = 100;
    Z *= k;
  }

  return { X, Y, Z };
}

/**
 * Convert a monochromatic wavelength to XYZ
 * Useful for testing and validation
 */
export function monochromaticToXYZ(wavelength: number): XYZColor {
  const x = interpolateObserver(wavelength, 'x');
  const y = interpolateObserver(wavelength, 'y');
  const z = interpolateObserver(wavelength, 'z');

  const sum = x + y + z;
  if (sum === 0) {
    return { X: 0, Y: 0, Z: 0 };
  }

  // Normalize so that Y = 100
  const k = 100 / y;

  return {
    X: x * k,
    Y: 100,
    Z: z * k,
  };
}
