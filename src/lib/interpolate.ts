/**
 * Spectrum Data Interpolation
 *
 * Functions for interpolating spectrum data to uniform wavelength intervals
 */

import type { SpectrumPoint } from '../types/spectrum';

/**
 * Linear interpolation between two values
 */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Interpolate spectrum to uniform wavelength intervals
 *
 * @param spectrum Input spectrum points (can be non-uniform)
 * @param step Target wavelength step size (default: 1nm)
 * @param startWavelength Optional start wavelength (default: min in data)
 * @param endWavelength Optional end wavelength (default: max in data)
 * @returns Interpolated spectrum with uniform intervals
 */
export function interpolateSpectrum(
  spectrum: SpectrumPoint[],
  step: number = 1,
  startWavelength?: number,
  endWavelength?: number
): SpectrumPoint[] {
  if (spectrum.length === 0) {
    return [];
  }

  if (spectrum.length === 1) {
    return [...spectrum];
  }

  // Sort by wavelength
  const sorted = [...spectrum].sort((a, b) => a.wavelength - b.wavelength);

  // Determine range
  const start = startWavelength ?? sorted[0].wavelength;
  const end = endWavelength ?? sorted[sorted.length - 1].wavelength;

  const result: SpectrumPoint[] = [];

  for (let wavelength = start; wavelength <= end; wavelength += step) {
    // Find the two points to interpolate between
    let lowerIndex = 0;

    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i].wavelength <= wavelength && sorted[i + 1].wavelength >= wavelength) {
        lowerIndex = i;
        break;
      }
      if (sorted[i].wavelength > wavelength) {
        break;
      }
      lowerIndex = i;
    }

    const lower = sorted[lowerIndex];
    const upper = sorted[Math.min(lowerIndex + 1, sorted.length - 1)];

    // Handle edge cases
    if (wavelength <= lower.wavelength) {
      result.push({ wavelength, intensity: lower.intensity });
      continue;
    }

    if (wavelength >= upper.wavelength) {
      result.push({ wavelength, intensity: upper.intensity });
      continue;
    }

    // Linear interpolation
    const t = (wavelength - lower.wavelength) / (upper.wavelength - lower.wavelength);
    const intensity = lerp(lower.intensity, upper.intensity, t);

    result.push({ wavelength, intensity });
  }

  return result;
}

/**
 * Interpolate spectrum to standard visible range with 1nm steps
 *
 * @param spectrum Input spectrum points
 * @returns Interpolated spectrum from 380nm to 780nm with 1nm steps
 */
export function interpolateToVisibleRange(spectrum: SpectrumPoint[]): SpectrumPoint[] {
  return interpolateSpectrum(spectrum, 1, 380, 780);
}

/**
 * Resample spectrum to a specific number of points
 *
 * @param spectrum Input spectrum points
 * @param numPoints Target number of points
 * @returns Resampled spectrum
 */
export function resampleSpectrum(spectrum: SpectrumPoint[], numPoints: number): SpectrumPoint[] {
  if (spectrum.length === 0 || numPoints < 2) {
    return [...spectrum];
  }

  const sorted = [...spectrum].sort((a, b) => a.wavelength - b.wavelength);
  const start = sorted[0].wavelength;
  const end = sorted[sorted.length - 1].wavelength;
  const step = (end - start) / (numPoints - 1);

  return interpolateSpectrum(sorted, step, start, end);
}

/**
 * Ensure spectrum covers the full visible range
 * Extends spectrum with zero intensity if needed
 *
 * @param spectrum Input spectrum points
 * @returns Spectrum covering 380-780nm
 */
export function extendToVisibleRange(spectrum: SpectrumPoint[]): SpectrumPoint[] {
  if (spectrum.length === 0) {
    // Return empty spectrum covering visible range
    const result: SpectrumPoint[] = [];
    for (let wl = 380; wl <= 780; wl += 1) {
      result.push({ wavelength: wl, intensity: 0 });
    }
    return result;
  }

  const sorted = [...spectrum].sort((a, b) => a.wavelength - b.wavelength);
  const minWl = sorted[0].wavelength;
  const maxWl = sorted[sorted.length - 1].wavelength;

  // First interpolate the original data
  const interpolated = interpolateSpectrum(sorted, 1);

  const result: SpectrumPoint[] = [];

  // Add zeros before data if needed
  for (let wl = 380; wl < minWl && wl <= 780; wl += 1) {
    result.push({ wavelength: wl, intensity: 0 });
  }

  // Add interpolated data
  for (const point of interpolated) {
    if (point.wavelength >= 380 && point.wavelength <= 780) {
      result.push(point);
    }
  }

  // Add zeros after data if needed
  for (let wl = Math.ceil(maxWl) + 1; wl <= 780; wl += 1) {
    if (wl > maxWl) {
      result.push({ wavelength: wl, intensity: 0 });
    }
  }

  return result;
}
