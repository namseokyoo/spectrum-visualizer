/**
 * File Parser
 *
 * Parse CSV and TXT files containing spectrum data
 */

import * as Sentry from '@sentry/react';
import type { SpectrumPoint } from '../types/spectrum';

/**
 * Detect delimiter in a line of text
 */
function detectDelimiter(line: string): string {
  const delimiters = ['\t', ',', ';', ' '];

  for (const delimiter of delimiters) {
    const parts = line.split(delimiter).filter((p) => p.trim() !== '');
    if (parts.length >= 2) {
      // Check if parts look like numbers
      const hasNumbers = parts.slice(0, 2).every((p) => !isNaN(parseFloat(p.trim())));
      if (hasNumbers) {
        return delimiter;
      }
    }
  }

  // Default to tab
  return '\t';
}

/**
 * Check if a line is a header (contains non-numeric values)
 */
function isHeaderLine(line: string, delimiter: string): boolean {
  const parts = line.split(delimiter).filter((p) => p.trim() !== '');

  if (parts.length < 2) {
    return true; // Likely a header or empty line
  }

  // If first two columns contain non-numeric text, it's a header
  return parts.slice(0, 2).some((p) => {
    const trimmed = p.trim();
    return isNaN(parseFloat(trimmed)) && trimmed !== '';
  });
}

/**
 * Parse a single line of spectrum data
 */
function parseDataLine(line: string, delimiter: string): SpectrumPoint | null {
  const parts = line.split(delimiter).filter((p) => p.trim() !== '');

  if (parts.length < 2) {
    return null;
  }

  const wavelength = parseFloat(parts[0].trim());
  const intensity = parseFloat(parts[1].trim());

  if (isNaN(wavelength) || isNaN(intensity)) {
    return null;
  }

  return { wavelength, intensity };
}

/**
 * Parse spectrum data from text content
 *
 * Supports various formats:
 * - CSV with comma delimiter
 * - TSV with tab delimiter
 * - Space-separated values
 * - Semicolon-separated values
 *
 * Automatically detects:
 * - Delimiter type
 * - Header rows (skips them)
 *
 * @param content Raw text content
 * @returns Array of spectrum points
 */
export function parseSpectrumText(content: string): SpectrumPoint[] {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '');

  if (lines.length === 0) {
    return [];
  }

  // Detect delimiter from first non-empty line
  const delimiter = detectDelimiter(lines[0]);

  const points: SpectrumPoint[] = [];
  let headerSkipped = false;

  for (const line of lines) {
    // Skip comment lines
    if (line.startsWith('#') || line.startsWith('//')) {
      continue;
    }

    // Skip header line
    if (!headerSkipped && isHeaderLine(line, delimiter)) {
      headerSkipped = true;
      continue;
    }

    const point = parseDataLine(line, delimiter);
    if (point) {
      points.push(point);
    }
  }

  return points;
}

/**
 * Parse spectrum data from a File object
 *
 * @param file File object from file input or drag-drop
 * @returns Promise resolving to spectrum points
 */
export async function parseSpectrumFile(file: File): Promise<SpectrumPoint[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === 'string') {
        try {
          const points = parseSpectrumText(content);
          resolve(points);
        } catch (error) {
          Sentry.captureException(error, { tags: { context: 'file-parser' } });
          reject(new Error(`Failed to parse file: ${error}`));
        }
      } else {
        reject(new Error('Failed to read file content'));
      }
    };

    reader.onerror = () => {
      const err = new Error('Failed to read file');
      Sentry.captureException(err, { tags: { context: 'file-parser' } });
      reject(err);
    };

    reader.readAsText(file);
  });
}

/**
 * Validate spectrum data
 *
 * @param points Spectrum points to validate
 * @returns Object containing validation result and any errors
 */
export function validateSpectrumData(points: SpectrumPoint[]): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (points.length === 0) {
    errors.push('No data points found');
    return { valid: false, errors, warnings };
  }

  if (points.length < 3) {
    warnings.push('Very few data points - results may be inaccurate');
  }

  // Check for valid wavelength range
  const wavelengths = points.map((p) => p.wavelength);
  const minWl = Math.min(...wavelengths);
  const maxWl = Math.max(...wavelengths);

  if (minWl < 300 || maxWl > 900) {
    warnings.push('Wavelength range extends beyond typical visible spectrum (380-780nm)');
  }

  if (maxWl - minWl < 10) {
    warnings.push('Wavelength range is very narrow');
  }

  // Check for negative intensities
  const hasNegative = points.some((p) => p.intensity < 0);
  if (hasNegative) {
    warnings.push('Negative intensity values detected - will be treated as zero');
  }

  // Check for duplicates
  const uniqueWavelengths = new Set(wavelengths);
  if (uniqueWavelengths.size !== wavelengths.length) {
    warnings.push('Duplicate wavelength values detected - using first occurrence');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
