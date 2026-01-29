/**
 * Preset Spectrum Data
 *
 * Standard emission spectra for testing and demonstration
 */

import type { SpectrumPoint } from '../types/spectrum';

/**
 * Generate a Gaussian emission spectrum
 *
 * @param peakWavelength Center wavelength in nm
 * @param fwhm Full width at half maximum in nm
 * @param startWavelength Start of wavelength range
 * @param endWavelength End of wavelength range
 * @param step Wavelength step size
 * @returns Array of spectrum points
 */
export function generateGaussianSpectrum(
  peakWavelength: number,
  fwhm: number,
  startWavelength: number = 380,
  endWavelength: number = 780,
  step: number = 1
): SpectrumPoint[] {
  const sigma = fwhm / (2 * Math.sqrt(2 * Math.log(2)));
  const points: SpectrumPoint[] = [];

  for (let wavelength = startWavelength; wavelength <= endWavelength; wavelength += step) {
    const exponent = -Math.pow(wavelength - peakWavelength, 2) / (2 * sigma * sigma);
    const intensity = Math.exp(exponent);
    points.push({ wavelength, intensity });
  }

  return points;
}

/**
 * Preset: Blue OLED emission spectrum
 * Typical blue emitter (e.g., Ir complex)
 * Peak: ~470nm, FWHM: ~40nm
 */
export const PRESET_BLUE: SpectrumPoint[] = generateGaussianSpectrum(470, 40);

/**
 * Preset: Green OLED emission spectrum
 * Typical green emitter
 * Peak: ~530nm, FWHM: ~50nm
 */
export const PRESET_GREEN: SpectrumPoint[] = generateGaussianSpectrum(530, 50);

/**
 * Preset: Red OLED emission spectrum
 * Typical red emitter
 * Peak: ~620nm, FWHM: ~50nm
 */
export const PRESET_RED: SpectrumPoint[] = generateGaussianSpectrum(620, 50);

/**
 * Preset: White LED spectrum (approximation)
 * Blue peak + phosphor-converted yellow
 */
export function generateWhiteSpectrum(): SpectrumPoint[] {
  const blue = generateGaussianSpectrum(450, 25);
  const yellow = generateGaussianSpectrum(570, 80);

  return blue.map((point, index) => ({
    wavelength: point.wavelength,
    intensity: point.intensity * 0.4 + yellow[index].intensity * 0.6,
  }));
}

export const PRESET_WHITE = generateWhiteSpectrum();

/**
 * All presets as a map
 */
export const PRESETS = {
  blue: { name: 'Blue (470nm)', data: PRESET_BLUE },
  green: { name: 'Green (530nm)', data: PRESET_GREEN },
  red: { name: 'Red (620nm)', data: PRESET_RED },
  white: { name: 'White LED', data: PRESET_WHITE },
} as const;

export type PresetKey = keyof typeof PRESETS;

/**
 * Get preset by key
 */
export function getPreset(key: PresetKey): SpectrumPoint[] {
  return [...PRESETS[key].data];
}

/**
 * Generate a monochromatic (single wavelength) spectrum
 * Useful for testing color coordinate calculations
 */
export function generateMonochromatic(wavelength: number): SpectrumPoint[] {
  const points: SpectrumPoint[] = [];

  for (let wl = 380; wl <= 780; wl += 1) {
    const intensity = wl === wavelength ? 1 : (Math.abs(wl - wavelength) <= 1 ? 0.5 : 0);
    points.push({ wavelength: wl, intensity });
  }

  return points;
}
