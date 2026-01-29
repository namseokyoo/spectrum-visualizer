/**
 * Core type definitions for the Spectrum Visualizer
 */

// Spectrum data point
export interface SpectrumPoint {
  wavelength: number;  // nm
  intensity: number;   // 0-1 (normalized)
}

// Full spectrum data
export interface SpectrumData {
  points: SpectrumPoint[];
  minWavelength: number;
  maxWavelength: number;
  peakWavelength: number;
}

// CIE XYZ tristimulus values
export interface XYZColor {
  X: number;
  Y: number;
  Z: number;
}

// CIE 1931 xy chromaticity coordinates
export interface CIE1931Coordinates {
  x: number;
  y: number;
}

// CIE 1976 u'v' chromaticity coordinates
export interface CIE1976Coordinates {
  u: number;
  v: number;
}

// Combined chromaticity result
export interface ChromaticityResult {
  xyz: XYZColor;
  cie1931: CIE1931Coordinates;
  cie1976: CIE1976Coordinates;
  dominantWavelength: number;
  hexColor: string;
}

// Snapshot data structure
export interface Snapshot {
  id: string;
  timestamp: number;
  shiftNm: number;
  chromaticity: ChromaticityResult;
  label?: string;
}

// Diagram mode
export type DiagramMode = 'CIE1931' | 'CIE1976';

// Color gamut type
export type GamutType = 'sRGB' | 'DCI-P3' | 'BT.2020' | 'AdobeRGB';
