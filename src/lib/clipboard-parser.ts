/**
 * Clipboard Parser
 *
 * Parse spectrum data from clipboard paste (Excel, Origin, etc.)
 */

import { parseSpectrumText, validateSpectrumData } from './file-parser';
import type { SpectrumPoint } from '../types/spectrum';

/**
 * Parse spectrum data from clipboard text
 *
 * Handles data copied from:
 * - Excel (tab-separated)
 * - Origin
 * - Google Sheets
 * - Plain text files
 *
 * @param clipboardText Text from clipboard
 * @returns Parsed spectrum points
 */
export function parseClipboardData(clipboardText: string): SpectrumPoint[] {
  // Clean up the text
  const cleaned = clipboardText
    .replace(/\r\n/g, '\n')  // Normalize line endings
    .replace(/^\s+|\s+$/g, '');  // Trim whitespace

  return parseSpectrumText(cleaned);
}

/**
 * Parse and validate clipboard data
 *
 * @param clipboardText Text from clipboard
 * @returns Object with parsed data and validation results
 */
export function parseAndValidateClipboard(clipboardText: string): {
  data: SpectrumPoint[];
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  try {
    const data = parseClipboardData(clipboardText);
    const validation = validateSpectrumData(data);

    return {
      data: validation.valid ? data : [],
      ...validation,
    };
  } catch (error) {
    return {
      data: [],
      valid: false,
      errors: [`Failed to parse clipboard data: ${error}`],
      warnings: [],
    };
  }
}

/**
 * Check if clipboard contains spectrum-like data
 *
 * @param clipboardText Text from clipboard
 * @returns True if data looks like spectrum data
 */
export function isSpectrumData(clipboardText: string): boolean {
  const lines = clipboardText.split(/\r?\n/).filter((line) => line.trim() !== '');

  if (lines.length < 2) {
    return false;
  }

  // Check if at least some lines have two numeric columns
  let numericLines = 0;

  for (const line of lines.slice(0, 10)) {  // Check first 10 lines
    const parts = line.split(/[\t,;\s]+/).filter((p) => p.trim() !== '');

    if (parts.length >= 2) {
      const first = parseFloat(parts[0]);
      const second = parseFloat(parts[1]);

      if (!isNaN(first) && !isNaN(second)) {
        numericLines++;
      }
    }
  }

  // If at least half of the checked lines have numeric pairs, it's likely spectrum data
  return numericLines >= Math.min(lines.length, 5);
}

/**
 * Get example format string for user guidance
 */
export function getExampleFormat(): string {
  return `Example format (tab or comma separated):
Wavelength\tIntensity
380\t0.001
381\t0.002
382\t0.003
...

Or without header:
380,0.001
381,0.002
382,0.003`;
}

/**
 * Create sample data for testing
 */
export function createSampleData(): string {
  const lines: string[] = ['Wavelength\tIntensity'];

  // Generate a simple Gaussian spectrum
  const peak = 550;
  const sigma = 25;

  for (let wl = 400; wl <= 700; wl += 5) {
    const intensity = Math.exp(-Math.pow(wl - peak, 2) / (2 * sigma * sigma));
    lines.push(`${wl}\t${intensity.toFixed(6)}`);
  }

  return lines.join('\n');
}
