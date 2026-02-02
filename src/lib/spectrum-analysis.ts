/**
 * Spectrum Analysis Utilities
 *
 * Provides analysis functions for emission spectrum data including
 * peak detection and width measurements (FWHM, FWQM)
 */

import type { SpectrumPoint } from '../types/spectrum';

export interface SpectrumAnalysis {
  peakWavelength: number;                  // Peak wavelength (nm)
  peakIntensity: number;                   // Peak intensity value
  fwhm: number | null;                     // Full Width at Half Maximum (nm)
  fwhmRange: [number, number] | null;      // FWHM range [left, right]
  fwqm: number | null;                     // Full Width at Quarter Maximum (nm)
  fwqmRange: [number, number] | null;      // FWQM range [left, right]
}

/**
 * Analyze spectrum data to extract peak and width measurements
 *
 * @param spectrum Array of spectrum points
 * @param shiftNm Wavelength shift to apply (nm)
 * @returns SpectrumAnalysis object with peak and width data
 */
export function analyzeSpectrum(spectrum: SpectrumPoint[], shiftNm: number = 0): SpectrumAnalysis {
  if (!spectrum || spectrum.length === 0) {
    return {
      peakWavelength: 0,
      peakIntensity: 0,
      fwhm: null,
      fwhmRange: null,
      fwqm: null,
      fwqmRange: null,
    };
  }

  // Sort by wavelength for consistent traversal
  const sorted = [...spectrum].sort((a, b) => a.wavelength - b.wavelength);

  // 1. Find Peak
  let peakIdx = 0;
  let peakIntensity = -Infinity;
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].intensity > peakIntensity) {
      peakIntensity = sorted[i].intensity;
      peakIdx = i;
    }
  }
  const peakWavelength = sorted[peakIdx].wavelength + shiftNm;

  // 2. Calculate FWHM (Half Maximum = 50%)
  const halfMax = peakIntensity / 2;
  const fwhmRange = findWidthAtLevel(sorted, peakIdx, halfMax, shiftNm);
  const fwhm = fwhmRange ? fwhmRange[1] - fwhmRange[0] : null;

  // 3. Calculate FWQM (Quarter Maximum = 25%)
  const quarterMax = peakIntensity / 4;
  const fwqmRange = findWidthAtLevel(sorted, peakIdx, quarterMax, shiftNm);
  const fwqm = fwqmRange ? fwqmRange[1] - fwqmRange[0] : null;

  return {
    peakWavelength,
    peakIntensity,
    fwhm,
    fwhmRange,
    fwqm,
    fwqmRange,
  };
}

/**
 * Find the width of the spectrum at a specific intensity level
 * Uses linear interpolation for precise edge detection
 *
 * @param spectrum Sorted spectrum points
 * @param peakIdx Index of the peak
 * @param level Intensity level to measure width at
 * @param shiftNm Wavelength shift to apply
 * @returns [leftWavelength, rightWavelength] or null if not found
 */
function findWidthAtLevel(
  spectrum: SpectrumPoint[],
  peakIdx: number,
  level: number,
  shiftNm: number
): [number, number] | null {
  // Search left from peak for crossing point
  let leftWl: number | null = null;
  for (let i = peakIdx; i > 0; i--) {
    if (spectrum[i].intensity >= level && spectrum[i - 1].intensity < level) {
      // Linear interpolation between points
      const t = (level - spectrum[i - 1].intensity) / (spectrum[i].intensity - spectrum[i - 1].intensity);
      leftWl = spectrum[i - 1].wavelength + t * (spectrum[i].wavelength - spectrum[i - 1].wavelength) + shiftNm;
      break;
    }
  }

  // Search right from peak for crossing point
  let rightWl: number | null = null;
  for (let i = peakIdx; i < spectrum.length - 1; i++) {
    if (spectrum[i].intensity >= level && spectrum[i + 1].intensity < level) {
      // Linear interpolation between points
      const t = (level - spectrum[i].intensity) / (spectrum[i + 1].intensity - spectrum[i].intensity);
      rightWl = spectrum[i].wavelength + t * (spectrum[i + 1].wavelength - spectrum[i].wavelength) + shiftNm;
      break;
    }
  }

  if (leftWl !== null && rightWl !== null) {
    return [leftWl, rightWl];
  }
  return null;
}
