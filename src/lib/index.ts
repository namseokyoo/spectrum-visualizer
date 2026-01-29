/**
 * Library exports for Spectrum Visualizer
 */

// Core algorithms
export { spectrumToXYZ, monochromaticToXYZ } from './spectrum-to-xyz';
export { xyzToXY, xyzToUV, xyToUV, uvToXY, colorDifferenceUV, isInGamut } from './chromaticity';
export { xyzToRGB, rgbToHex, xyzToHex, isInSRGBGamut, getDisplayableColor } from './color-convert';

// Spectrum operations
export {
  shiftSpectrum,
  shiftSpectrumClamped,
  getPeakWavelength,
  getFWHM,
  createSpectrumData,
} from './wavelength-shift';

// Data processing
export { normalizeSpectrum, normalizeToRange, baselineCorrection, smoothSpectrum } from './normalize';
export {
  interpolateSpectrum,
  interpolateToVisibleRange,
  resampleSpectrum,
  extendToVisibleRange,
} from './interpolate';

// Parsers
export { parseSpectrumText, parseSpectrumFile, validateSpectrumData } from './file-parser';
export {
  parseClipboardData,
  parseAndValidateClipboard,
  isSpectrumData,
  getExampleFormat,
  createSampleData,
} from './clipboard-parser';

// Presets
export {
  PRESETS,
  PRESET_BLUE,
  PRESET_GREEN,
  PRESET_RED,
  PRESET_WHITE,
  getPreset,
  generateGaussianSpectrum,
  generateMonochromatic,
  type PresetKey,
} from './presets';

// Combined chromaticity calculation utility
import type { SpectrumPoint, ChromaticityResult } from '../types/spectrum';
import { spectrumToXYZ } from './spectrum-to-xyz';
import { xyzToXY, xyzToUV } from './chromaticity';
import { xyzToHex } from './color-convert';
import { getPeakWavelength } from './wavelength-shift';

/**
 * Calculate all chromaticity values from spectrum data
 */
export function calculateChromaticity(spectrum: SpectrumPoint[]): ChromaticityResult {
  const xyz = spectrumToXYZ(spectrum);
  const cie1931 = xyzToXY(xyz);
  const cie1976 = xyzToUV(xyz);
  const hexColor = xyzToHex(xyz);
  const dominantWavelength = getPeakWavelength(spectrum);

  return {
    xyz,
    cie1931,
    cie1976,
    dominantWavelength,
    hexColor,
  };
}
