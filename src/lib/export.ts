/**
 * Export Utilities for Spectrum Visualizer (ISCV)
 *
 * Phase 1: CSV and SVG export functionality
 * Phase 2: PNG (high-resolution) and JSON (session state) export
 * - CSV: Multi-column spectrum data with metadata header
 * - SVG: Serialized diagram with inline styles
 * - PNG: High-resolution raster image via html-to-image (2x pixelRatio)
 * - JSON: Full session state for re-import compatibility
 */

import { toPng } from 'html-to-image';
import type { SpectrumPoint, ChromaticityResult, DiagramMode, GamutType, Snapshot } from '../types/spectrum';
import type { SpectrumAnalysis } from './spectrum-analysis';
import { shiftSpectrum } from './wavelength-shift';
import { calculateChromaticity } from './index';
import { analyzeSpectrum } from './spectrum-analysis';

// ============================================
// Types
// ============================================

export interface ExportCSVOptions {
  includeSnapshots: boolean;
}

export interface ExportSVGOptions {
  includeInlineStyles: boolean;
}

export interface ExportPNGOptions {
  pixelRatio: number;
  backgroundColor: string;
}

export interface ExportJSONOptions {
  includeSnapshots: boolean;
}

export interface ExportData {
  spectrum: SpectrumPoint[];
  chromaticity: ChromaticityResult;
  analysis: SpectrumAnalysis;
  diagramMode: DiagramMode;
  shiftNm: number;
  snapshots: Snapshot[];
}

export interface ExportJSONData extends ExportData {
  enabledGamuts: GamutType[];
  intensityScale: number;
}

/** JSON export file schema version for forward compatibility */
const EXPORT_JSON_VERSION = '1.0.0';

// ============================================
// Filename Generation
// ============================================

/**
 * Generate export filename with timestamp
 * Format: ISCV_YYYYMMDD_HHmm.{format}
 */
export function generateFilename(format: 'csv' | 'svg' | 'png' | 'json'): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');

  return `ISCV_${year}${month}${day}_${hours}${minutes}.${format}`;
}

/**
 * Format date for metadata header
 * Format: YYYY-MM-DD HH:mm
 */
function formatExportDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

// ============================================
// CSV Export
// ============================================

/**
 * Build CSV metadata header comments
 */
function buildCSVMetadataHeader(data: ExportData): string {
  const lines: string[] = [];

  lines.push(`# Spectrum Visualizer (ISCV) v1.1.0`);
  lines.push(`# Export Date: ${formatExportDate()}`);
  lines.push(`# Diagram Mode: ${data.diagramMode === 'CIE1931' ? 'CIE1931' : 'CIE1976'}`);
  lines.push(`# Wavelength Shift: ${data.shiftNm >= 0 ? '+' : ''}${data.shiftNm.toFixed(1)}nm`);
  lines.push(`# Peak Wavelength: ${data.analysis.peakWavelength.toFixed(1)}nm`);
  lines.push(`# FWHM: ${data.analysis.fwhm !== null ? data.analysis.fwhm.toFixed(1) + 'nm' : 'N/A'}`);
  lines.push(`# CIE 1931: (x=${data.chromaticity.cie1931.x.toFixed(4)}, y=${data.chromaticity.cie1931.y.toFixed(4)})`);
  lines.push(`# CIE 1976: (u'=${data.chromaticity.cie1976.u.toFixed(4)}, v'=${data.chromaticity.cie1976.v.toFixed(4)})`);
  lines.push(`# Dominant Wavelength: ${data.chromaticity.dominantWavelength.toFixed(1)}nm`);
  lines.push(`# Color: ${data.chromaticity.hexColor}`);

  return lines.join('\n');
}

/**
 * Build snapshot metadata for CSV header
 */
function buildSnapshotMetadata(snapshots: Snapshot[], spectrum: SpectrumPoint[]): string {
  if (snapshots.length === 0) return '';

  const lines: string[] = [];
  lines.push(`#`);
  lines.push(`# Snapshots: ${snapshots.length}`);

  snapshots.forEach((snap, idx) => {
    const snapshotSpectrum = shiftSpectrum(spectrum, snap.shiftNm);
    const snapshotChromaticity = calculateChromaticity(snapshotSpectrum);
    const snapshotAnalysis = analyzeSpectrum(spectrum, snap.shiftNm);

    lines.push(`# Snapshot #${idx + 1}:`);
    lines.push(`#   Shift: ${snap.shiftNm >= 0 ? '+' : ''}${snap.shiftNm.toFixed(1)}nm`);
    lines.push(`#   Peak: ${snapshotAnalysis.peakWavelength.toFixed(1)}nm`);
    lines.push(`#   CIE 1931: (x=${snapshotChromaticity.cie1931.x.toFixed(4)}, y=${snapshotChromaticity.cie1931.y.toFixed(4)})`);
    lines.push(`#   Color: ${snapshotChromaticity.hexColor}`);
  });

  return lines.join('\n');
}

/**
 * Export spectrum data as CSV string
 */
export function exportCSV(data: ExportData, options: ExportCSVOptions): string {
  const parts: string[] = [];

  // 1. Metadata header
  parts.push(buildCSVMetadataHeader(data));

  // 2. Snapshot metadata (if included)
  if (options.includeSnapshots && data.snapshots.length > 0) {
    parts.push(buildSnapshotMetadata(data.snapshots, data.spectrum));
  }

  parts.push('#');

  // 3. Column header
  const columns = ['Wavelength', 'Current_Intensity'];

  if (options.includeSnapshots && data.snapshots.length > 0) {
    data.snapshots.forEach((_, idx) => {
      columns.push(`Snapshot_${idx + 1}_Intensity`);
    });
  }

  parts.push(columns.join(','));

  // 4. Shifted spectrum data for current state
  const shiftedSpectrum = shiftSpectrum(data.spectrum, data.shiftNm);

  // 5. Build snapshot shifted spectra (if included)
  const snapshotSpectra: SpectrumPoint[][] = [];
  if (options.includeSnapshots && data.snapshots.length > 0) {
    data.snapshots.forEach((snap) => {
      snapshotSpectra.push(shiftSpectrum(data.spectrum, snap.shiftNm));
    });
  }

  // 6. Data rows - use shifted wavelengths
  shiftedSpectrum.forEach((point, i) => {
    const row = [
      point.wavelength.toFixed(1),
      point.intensity.toFixed(6),
    ];

    if (options.includeSnapshots && snapshotSpectra.length > 0) {
      snapshotSpectra.forEach((snapSpec) => {
        // Use same index since all spectra have same length
        const snapPoint = snapSpec[i];
        row.push(snapPoint ? snapPoint.intensity.toFixed(6) : '0.000000');
      });
    }

    parts.push(row.join(','));
  });

  return parts.join('\n');
}

// ============================================
// SVG Export
// ============================================

/**
 * CSS properties to preserve when inlining styles
 * Only the properties relevant to SVG rendering
 */
const SVG_STYLE_PROPERTIES = [
  'fill',
  'fill-opacity',
  'stroke',
  'stroke-width',
  'stroke-opacity',
  'stroke-dasharray',
  'stroke-linecap',
  'stroke-linejoin',
  'opacity',
  'font-family',
  'font-size',
  'font-weight',
  'text-anchor',
  'dominant-baseline',
  'visibility',
  'display',
  'cursor',
  'filter',
  'clip-path',
  'transform',
];

/**
 * Inject computed styles as inline styles on all SVG elements
 * This ensures the exported SVG looks the same without external CSS
 */
function injectInlineStyles(svgElement: SVGSVGElement): SVGSVGElement {
  // Clone the SVG to avoid modifying the live DOM
  const cloned = svgElement.cloneNode(true) as SVGSVGElement;

  // Get all elements in the cloned SVG
  const allElements = cloned.querySelectorAll('*');

  // For each element, get computed style from the original and apply inline
  const originalElements = svgElement.querySelectorAll('*');

  allElements.forEach((clonedEl, index) => {
    const originalEl = originalElements[index];
    if (!originalEl) return;

    const computedStyle = window.getComputedStyle(originalEl);
    const inlineStyles: string[] = [];

    SVG_STYLE_PROPERTIES.forEach((prop) => {
      const value = computedStyle.getPropertyValue(prop);
      if (value && value !== 'none' && value !== 'normal' && value !== '' && value !== 'auto') {
        // Skip default values that don't need to be inlined
        if (prop === 'fill' && value === 'rgb(0, 0, 0)') return;
        if (prop === 'stroke' && value === 'none') return;
        if (prop === 'opacity' && value === '1') return;
        if (prop === 'visibility' && value === 'visible') return;
        if (prop === 'display' && value === 'inline') return;
        if (prop === 'cursor' && value === 'auto') return;

        inlineStyles.push(`${prop}: ${value}`);
      }
    });

    if (inlineStyles.length > 0) {
      const existingStyle = (clonedEl as HTMLElement).getAttribute('style') || '';
      const newStyle = existingStyle
        ? `${existingStyle}; ${inlineStyles.join('; ')}`
        : inlineStyles.join('; ');
      (clonedEl as HTMLElement).setAttribute('style', newStyle);
    }
  });

  return cloned;
}

/**
 * Export SVG element as an SVG string
 */
export function exportSVG(
  svgElement: SVGSVGElement,
  options: ExportSVGOptions
): string {
  // Inject inline styles for standalone rendering (controlled by options.includeInlineStyles)
  const styledSvg = options.includeInlineStyles
    ? injectInlineStyles(svgElement)
    : svgElement.cloneNode(true) as SVGSVGElement;

  // Ensure xmlns attribute is set
  styledSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  styledSvg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

  // Set explicit width/height from the rendered dimensions
  const rect = svgElement.getBoundingClientRect();
  styledSvg.setAttribute('width', String(Math.round(rect.width)));
  styledSvg.setAttribute('height', String(Math.round(rect.height)));

  // Serialize to string
  const serializer = new XMLSerializer();
  let svgString = serializer.serializeToString(styledSvg);

  // Add XML declaration
  svgString = '<?xml version="1.0" encoding="UTF-8"?>\n' + svgString;

  return svgString;
}

// ============================================
// PNG Export
// ============================================

/**
 * Export an HTML element as a high-resolution PNG data URL
 * Uses html-to-image with configurable pixel ratio for print-quality output
 *
 * @returns Data URL string (data:image/png;base64,...)
 */
export async function exportPNG(
  element: HTMLElement,
  options: ExportPNGOptions
): Promise<string> {
  const dataUrl = await toPng(element, {
    pixelRatio: options.pixelRatio,
    backgroundColor: options.backgroundColor,
    // Filter out elements that should not appear in the export
    filter: (node: HTMLElement) => {
      // Skip hidden elements that have data-export-ignore attribute
      if (node.dataset?.exportIgnore === 'true') return false;
      return true;
    },
  });
  return dataUrl;
}

// ============================================
// JSON Export
// ============================================

/**
 * Serialized JSON structure for full session export
 */
interface ExportJSONFile {
  version: string;
  exportDate: string;
  application: string;
  session: {
    spectrum: SpectrumPoint[];
    shiftNm: number;
    diagramMode: DiagramMode;
    enabledGamuts: GamutType[];
    intensityScale: number;
  };
  computed: {
    chromaticity: ChromaticityResult;
    analysis: SpectrumAnalysis;
  };
  snapshots?: Snapshot[];
}

/**
 * Export session state as structured JSON string
 * Includes version metadata for future re-import compatibility
 */
export function exportJSON(data: ExportJSONData, options: ExportJSONOptions): string {
  const jsonFile: ExportJSONFile = {
    version: EXPORT_JSON_VERSION,
    exportDate: formatExportDate(),
    application: 'Spectrum Visualizer (ISCV)',
    session: {
      spectrum: data.spectrum,
      shiftNm: data.shiftNm,
      diagramMode: data.diagramMode,
      enabledGamuts: data.enabledGamuts,
      intensityScale: data.intensityScale,
    },
    computed: {
      chromaticity: data.chromaticity,
      analysis: data.analysis,
    },
  };

  if (options.includeSnapshots && data.snapshots.length > 0) {
    jsonFile.snapshots = data.snapshots;
  }

  return JSON.stringify(jsonFile, null, 2);
}

// ============================================
// Download Trigger
// ============================================

/**
 * Trigger file download via Blob URL
 */
export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();

  // Cleanup
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Trigger file download from a data URL (used by PNG export)
 */
export function downloadDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();

  // Cleanup
  document.body.removeChild(link);
}
