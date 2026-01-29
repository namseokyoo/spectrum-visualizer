/**
 * Spectrum Data Normalization
 *
 * Functions for normalizing spectrum intensity values
 */

import type { SpectrumPoint } from '../types/spectrum';

/**
 * Normalize spectrum intensity so that max value = 1.0
 *
 * @param spectrum Input spectrum points
 * @returns Normalized spectrum points
 */
export function normalizeSpectrum(spectrum: SpectrumPoint[]): SpectrumPoint[] {
  if (spectrum.length === 0) {
    return [];
  }

  const maxIntensity = Math.max(...spectrum.map((p) => p.intensity));

  if (maxIntensity === 0) {
    return spectrum.map((p) => ({ ...p, intensity: 0 }));
  }

  return spectrum.map((point) => ({
    wavelength: point.wavelength,
    intensity: point.intensity / maxIntensity,
  }));
}

/**
 * Normalize spectrum intensity to a specific range
 *
 * @param spectrum Input spectrum points
 * @param minValue Target minimum value (default: 0)
 * @param maxValue Target maximum value (default: 1)
 * @returns Normalized spectrum points
 */
export function normalizeToRange(
  spectrum: SpectrumPoint[],
  minValue: number = 0,
  maxValue: number = 1
): SpectrumPoint[] {
  if (spectrum.length === 0) {
    return [];
  }

  const intensities = spectrum.map((p) => p.intensity);
  const currentMin = Math.min(...intensities);
  const currentMax = Math.max(...intensities);
  const currentRange = currentMax - currentMin;

  if (currentRange === 0) {
    return spectrum.map((p) => ({
      ...p,
      intensity: (minValue + maxValue) / 2,
    }));
  }

  const targetRange = maxValue - minValue;

  return spectrum.map((point) => ({
    wavelength: point.wavelength,
    intensity: ((point.intensity - currentMin) / currentRange) * targetRange + minValue,
  }));
}

/**
 * Apply baseline correction (subtract minimum value)
 *
 * @param spectrum Input spectrum points
 * @returns Baseline-corrected spectrum
 */
export function baselineCorrection(spectrum: SpectrumPoint[]): SpectrumPoint[] {
  if (spectrum.length === 0) {
    return [];
  }

  const minIntensity = Math.min(...spectrum.map((p) => p.intensity));

  return spectrum.map((point) => ({
    wavelength: point.wavelength,
    intensity: Math.max(0, point.intensity - minIntensity),
  }));
}

/**
 * Smooth spectrum using moving average
 *
 * @param spectrum Input spectrum points
 * @param windowSize Number of points in the moving average window (odd number)
 * @returns Smoothed spectrum
 */
export function smoothSpectrum(spectrum: SpectrumPoint[], windowSize: number = 3): SpectrumPoint[] {
  if (spectrum.length === 0 || windowSize < 1) {
    return [...spectrum];
  }

  // Ensure window size is odd
  const halfWindow = Math.floor(windowSize / 2);
  const sorted = [...spectrum].sort((a, b) => a.wavelength - b.wavelength);

  return sorted.map((point, index) => {
    const start = Math.max(0, index - halfWindow);
    const end = Math.min(sorted.length - 1, index + halfWindow);
    let sum = 0;
    let count = 0;

    for (let i = start; i <= end; i++) {
      sum += sorted[i].intensity;
      count++;
    }

    return {
      wavelength: point.wavelength,
      intensity: sum / count,
    };
  });
}
