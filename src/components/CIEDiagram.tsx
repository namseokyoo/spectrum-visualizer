/**
 * CIE Chromaticity Diagram Component
 *
 * D3.js-based interactive visualization of CIE color spaces
 * Supports both CIE 1931 xy and CIE 1976 u'v' representations
 * Features Spectrum-on-Locus visualization with draggable spectrum ridge
 *
 * Performance Optimizations (ISCV Phase 1):
 * - Static/Dynamic element separation for partial updates
 * - D3 enter/update/exit pattern instead of full re-render
 * - requestAnimationFrame for smooth 60fps dragging
 * - Enhanced drag UX with hover highlight and tooltips
 *
 * Phase 2 Enhancements:
 * - Pan/Zoom functionality with d3-zoom
 * - Keyboard navigation for wavelength adjustment
 * - Loading indicator for initial render
 */

import { useEffect, useRef, useMemo, useCallback, useState } from 'react';
import * as d3 from 'd3';
import type { ZoomBehavior, ZoomTransform } from 'd3';
import { SPECTRAL_LOCUS_XY, COLOR_GAMUTS } from '../data/cie1931';
import { xyToUV } from '../lib/chromaticity';
import { AxisRangeModal } from './AxisRangeModal';
import type {
  CIE1931Coordinates,
  CIE1976Coordinates,
  DiagramMode,
  GamutType,
  Snapshot,
  SpectrumPoint,
} from '../types/spectrum';

// Wavelength to approximate RGB color for spectral locus gradient
function wavelengthToRGB(wavelength: number): string {
  let r = 0, g = 0, b = 0;

  if (wavelength >= 380 && wavelength < 440) {
    r = -(wavelength - 440) / (440 - 380);
    g = 0;
    b = 1;
  } else if (wavelength >= 440 && wavelength < 490) {
    r = 0;
    g = (wavelength - 440) / (490 - 440);
    b = 1;
  } else if (wavelength >= 490 && wavelength < 510) {
    r = 0;
    g = 1;
    b = -(wavelength - 510) / (510 - 490);
  } else if (wavelength >= 510 && wavelength < 580) {
    r = (wavelength - 510) / (580 - 510);
    g = 1;
    b = 0;
  } else if (wavelength >= 580 && wavelength < 645) {
    r = 1;
    g = -(wavelength - 645) / (645 - 580);
    b = 0;
  } else if (wavelength >= 645 && wavelength <= 780) {
    r = 1;
    g = 0;
    b = 0;
  }

  // Intensity adjustment at the edges
  let intensity = 1;
  if (wavelength >= 380 && wavelength < 420) {
    intensity = 0.3 + 0.7 * (wavelength - 380) / (420 - 380);
  } else if (wavelength >= 700 && wavelength <= 780) {
    intensity = 0.3 + 0.7 * (780 - wavelength) / (780 - 700);
  }

  r = Math.round(255 * Math.pow(r * intensity, 0.8));
  g = Math.round(255 * Math.pow(g * intensity, 0.8));
  b = Math.round(255 * Math.pow(b * intensity, 0.8));

  return `rgb(${r},${g},${b})`;
}

// Convert xy coordinates to u'v' for CIE 1976 mode
function convertToMode(
  xy: CIE1931Coordinates,
  mode: DiagramMode
): { x: number; y: number } {
  if (mode === 'CIE1976') {
    const uv = xyToUV(xy);
    return { x: uv.u, y: uv.v };
  }
  return xy;
}

interface AxisRange {
  min: number;
  max: number;
}

interface CustomAxisRanges {
  x?: AxisRange;
  y?: AxisRange;
}

interface CIEDiagramProps {
  currentPoint: CIE1931Coordinates;
  currentPointUV?: CIE1976Coordinates;
  mode: DiagramMode;
  enabledGamuts: GamutType[];
  snapshots?: Snapshot[];
  onShiftChange?: (deltaX: number, deltaY: number) => void;
  hexColor?: string;
  spectrum?: SpectrumPoint[];
  shiftNm?: number;
  onWavelengthShift?: (delta: number) => void;
  theme?: 'dark' | 'light';
  intensityScale?: number;
  initialZoomTransform?: { k: number; x: number; y: number } | null;
  onZoomChange?: (transform: { k: number; x: number; y: number }) => void;
  customAxisRanges?: CustomAxisRanges;
  onAxisRangeChange?: (ranges: CustomAxisRanges) => void;
}

// Calculate normal vector at a point on the locus (pointing outward from the color space)
function calculateNormal(
  prev: { x: number; y: number },
  curr: { x: number; y: number },
  next: { x: number; y: number }
): { nx: number; ny: number } {
  // Calculate tangent direction
  const dx = next.x - prev.x;
  const dy = next.y - prev.y;
  const len = Math.sqrt(dx * dx + dy * dy);

  if (len === 0) return { nx: 0, ny: -1 };

  // Normal is perpendicular to tangent, pointing outward (away from color space center)
  // The center of the horseshoe is approximately at (0.33, 0.33)
  let nx = -dy / len;
  let ny = dx / len;

  // Ensure normal points outward (away from center)
  const centerX = 0.33;
  const centerY = 0.33;
  const toCenterX = centerX - curr.x;
  const toCenterY = centerY - curr.y;

  // If normal points toward center, flip it
  if (nx * toCenterX + ny * toCenterY > 0) {
    nx = -nx;
    ny = -ny;
  }

  return { nx, ny };
}

// Get spectrum intensity at a specific wavelength (with interpolation)
function getSpectrumIntensityAtWavelength(
  spectrum: SpectrumPoint[],
  wavelength: number,
  shiftNm: number
): number {
  if (!spectrum || spectrum.length === 0) return 0;

  // Apply shift: we're looking for the original wavelength that would map to this position
  const targetWavelength = wavelength - shiftNm;

  // Find surrounding points for interpolation
  for (let i = 0; i < spectrum.length - 1; i++) {
    const p1 = spectrum[i];
    const p2 = spectrum[i + 1];

    if (targetWavelength >= p1.wavelength && targetWavelength <= p2.wavelength) {
      // Linear interpolation
      const t = (targetWavelength - p1.wavelength) / (p2.wavelength - p1.wavelength);
      return p1.intensity * (1 - t) + p2.intensity * t;
    }
  }

  return 0;
}

/**
 * Find the precise peak wavelength using parabolic interpolation
 * This provides sub-nm precision for smooth peak tracking
 */
function findInterpolatedPeakWavelength(
  spectrum: SpectrumPoint[],
  shiftNm: number
): number {
  if (!spectrum || spectrum.length < 3) {
    // Fallback: return center of visible spectrum
    return 550;
  }

  // Find the index of maximum intensity in shifted spectrum
  let maxIdx = 0;
  let maxIntensity = -Infinity;

  for (let i = 0; i < spectrum.length; i++) {
    if (spectrum[i].intensity > maxIntensity) {
      maxIntensity = spectrum[i].intensity;
      maxIdx = i;
    }
  }

  // If peak is at boundary, we can't do parabolic interpolation
  if (maxIdx === 0 || maxIdx === spectrum.length - 1) {
    return spectrum[maxIdx].wavelength + shiftNm;
  }

  // Parabolic interpolation using 3 points around the maximum
  // For points (x0, y0), (x1, y1), (x2, y2) where y1 is max,
  // the parabola vertex x = x1 + 0.5 * (y0 - y2) / (y0 - 2*y1 + y2)
  const p0 = spectrum[maxIdx - 1];
  const p1 = spectrum[maxIdx];
  const p2 = spectrum[maxIdx + 1];

  const y0 = p0.intensity;
  const y1 = p1.intensity;
  const y2 = p2.intensity;

  const denominator = y0 - 2 * y1 + y2;

  // Avoid division by zero (flat peak)
  if (Math.abs(denominator) < 1e-10) {
    return p1.wavelength + shiftNm;
  }

  // Calculate the fractional offset from the center point
  const offset = 0.5 * (y0 - y2) / denominator;

  // Clamp the offset to prevent extrapolation beyond neighbors
  const clampedOffset = Math.max(-0.5, Math.min(0.5, offset));

  // Interpolate wavelength
  const wavelengthStep = p2.wavelength - p1.wavelength;
  const preciseWavelength = p1.wavelength + clampedOffset * wavelengthStep;

  // Apply shift to get the displayed wavelength
  return preciseWavelength + shiftNm;
}

/**
 * Calculate natural cubic spline coefficients
 * Returns array of {a, b, c, d} for each segment
 * Uses the Thomas algorithm for tridiagonal systems
 */
function calculateCubicSpline(
  x: number[],
  y: number[]
): { a: number; b: number; c: number; d: number }[] {
  const n = x.length - 1;
  const h: number[] = [];
  const alpha: number[] = [0]; // alpha[0] is unused, start from index 1
  const l: number[] = [1];
  const mu: number[] = [0];
  const z: number[] = [0];
  const c: number[] = new Array(n + 1);
  const b: number[] = new Array(n);
  const d: number[] = new Array(n);

  // Step 1: Calculate h[i] = x[i+1] - x[i]
  for (let i = 0; i < n; i++) {
    h[i] = x[i + 1] - x[i];
  }

  // Step 2: Calculate alpha (second derivative approximations)
  for (let i = 1; i < n; i++) {
    alpha[i] = (3 / h[i]) * (y[i + 1] - y[i]) - (3 / h[i - 1]) * (y[i] - y[i - 1]);
  }

  // Step 3-4: Solve tridiagonal system using Thomas algorithm
  for (let i = 1; i < n; i++) {
    l[i] = 2 * (x[i + 1] - x[i - 1]) - h[i - 1] * mu[i - 1];
    mu[i] = h[i] / l[i];
    z[i] = (alpha[i] - h[i - 1] * z[i - 1]) / l[i];
  }

  // Step 5: Back substitution
  l[n] = 1;
  z[n] = 0;
  c[n] = 0;

  for (let j = n - 1; j >= 0; j--) {
    c[j] = z[j] - mu[j] * c[j + 1];
    b[j] = (y[j + 1] - y[j]) / h[j] - h[j] * (c[j + 1] + 2 * c[j]) / 3;
    d[j] = (c[j + 1] - c[j]) / (3 * h[j]);
  }

  // Return coefficients for each segment
  // S_i(t) = a + b*(t-x_i) + c*(t-x_i)^2 + d*(t-x_i)^3
  const spline: { a: number; b: number; c: number; d: number }[] = [];
  for (let i = 0; i < n; i++) {
    spline.push({ a: y[i], b: b[i], c: c[i], d: d[i] });
  }

  return spline;
}

/**
 * Evaluate cubic spline at a given point
 * Uses binary search to find the correct segment for efficiency
 */
function evaluateSpline(
  spline: { a: number; b: number; c: number; d: number }[],
  x: number[],
  t: number
): number {
  // Binary search to find the correct segment
  let low = 0;
  let high = x.length - 2;

  while (low < high) {
    const mid = Math.floor((low + high + 1) / 2);
    if (x[mid] <= t) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }

  const i = low;

  // Clamp to valid range
  if (i < 0 || i >= spline.length) {
    return i < 0 ? spline[0].a : spline[spline.length - 1].a;
  }

  // Evaluate: S_i(t) = a + b*(t-x_i) + c*(t-x_i)^2 + d*(t-x_i)^3
  const dx = t - x[i];
  const { a, b, c, d } = spline[i];
  return a + b * dx + c * dx * dx + d * dx * dx * dx;
}

/**
 * Generate high-resolution locus data using cubic spline interpolation
 * This creates truly smooth curves, not just more points on straight lines
 */
function generateHighResolutionLocus(
  locusData: { wavelength: number; x: number; y: number }[],
  stepNm: number = 1
): { wavelength: number; x: number; y: number }[] {
  if (locusData.length < 2) return locusData;

  const n = locusData.length;
  const wavelengths = locusData.map(p => p.wavelength);
  const xValues = locusData.map(p => p.x);
  const yValues = locusData.map(p => p.y);

  // Calculate cubic spline coefficients for x and y separately
  const splineX = calculateCubicSpline(wavelengths, xValues);
  const splineY = calculateCubicSpline(wavelengths, yValues);

  const result: { wavelength: number; x: number; y: number }[] = [];

  // Generate interpolated points at stepNm intervals
  for (let wl = wavelengths[0]; wl <= wavelengths[n - 1]; wl += stepNm) {
    result.push({
      wavelength: wl,
      x: evaluateSpline(splineX, wavelengths, wl),
      y: evaluateSpline(splineY, wavelengths, wl),
    });
  }

  // Ensure the last point is included
  const last = locusData[n - 1];
  if (result.length === 0 || result[result.length - 1].wavelength !== last.wavelength) {
    result.push({ wavelength: last.wavelength, x: last.x, y: last.y });
  }

  return result;
}

/**
 * Interpolate position on the spectral locus for a given wavelength
 * Returns the x, y coordinates with sub-point precision
 */
function interpolateLocusPosition(
  wavelength: number,
  locusData: { wavelength: number; x: number; y: number }[]
): { x: number; y: number; nx: number; ny: number } | null {
  if (!locusData || locusData.length < 2) return null;

  // Find the two locus points that bracket this wavelength
  for (let i = 0; i < locusData.length - 1; i++) {
    const p1 = locusData[i];
    const p2 = locusData[i + 1];

    if (wavelength >= p1.wavelength && wavelength <= p2.wavelength) {
      // Linear interpolation factor
      const t = (wavelength - p1.wavelength) / (p2.wavelength - p1.wavelength);

      // Interpolate position
      const x = p1.x + t * (p2.x - p1.x);
      const y = p1.y + t * (p2.y - p1.y);

      // Calculate normal at this interpolated position
      // Use adjacent points for tangent calculation

      // Interpolate the normal as well for smooth direction
      const { nx: nx1, ny: ny1 } = calculateNormal(
        locusData[Math.max(0, i - 1)],
        p1,
        p2
      );
      const { nx: nx2, ny: ny2 } = calculateNormal(
        p1,
        p2,
        locusData[Math.min(locusData.length - 1, i + 2)]
      );

      // Interpolate normals
      let nx = nx1 + t * (nx2 - nx1);
      let ny = ny1 + t * (ny2 - ny1);

      // Normalize the interpolated normal
      const len = Math.sqrt(nx * nx + ny * ny);
      if (len > 0) {
        nx /= len;
        ny /= len;
      }

      return { x, y, nx, ny };
    }
  }

  // Wavelength outside locus range - return closest endpoint
  if (wavelength < locusData[0].wavelength) {
    const p = locusData[0];
    const { nx, ny } = calculateNormal(p, locusData[0], locusData[1]);
    return { x: p.x, y: p.y, nx, ny };
  } else {
    const p = locusData[locusData.length - 1];
    const len = locusData.length;
    const { nx, ny } = calculateNormal(locusData[len - 2], locusData[len - 1], p);
    return { x: p.x, y: p.y, nx, ny };
  }
}

export function CIEDiagram({
  currentPoint,
  currentPointUV,
  mode,
  enabledGamuts,
  snapshots = [],
  onShiftChange,
  hexColor = '#ffffff',
  spectrum = [],
  shiftNm = 0,
  onWavelengthShift,
  theme = 'dark',
  intensityScale = 1.0,
  initialZoomTransform,
  onZoomChange,
  customAxisRanges,
  onAxisRangeChange,
}: CIEDiagramProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const lastDragPos = useRef<{ x: number; y: number } | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const staticRenderedRef = useRef(false);
  // Base scales (original, for zoom reset)
  const baseScalesRef = useRef<{
    xScale: d3.ScaleLinear<number, number>;
    yScale: d3.ScaleLinear<number, number>;
  } | null>(null);
  // Current scales (zoom-adjusted)
  const scalesRef = useRef<{
    xScale: d3.ScaleLinear<number, number>;
    yScale: d3.ScaleLinear<number, number>;
  } | null>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const currentTransformRef = useRef<ZoomTransform>(d3.zoomIdentity);
  // Ref to store displayPoint for zoom filter (avoids triggering static re-render)
  const displayPointRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  // Flag to trigger dynamic redraw after zoom
  const [zoomTrigger, setZoomTrigger] = useState(0);

  // State for drag UX
  const [isHoveringRidge, setIsHoveringRidge] = useState(false);
  const [dragDelta, setDragDelta] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(1);

  // State for axis range modal
  const [axisRangeModal, setAxisRangeModal] = useState<{
    isOpen: boolean;
    axis: 'x' | 'y';
    min: number;
    max: number;
  } | null>(null);

  // Theme-based colors
  const themeColors = useMemo(() => ({
    bgPrimary: theme === 'dark' ? '#0f0f14' : '#ffffff',
    bgSecondary: theme === 'dark' ? '#1a1a2e' : '#f5f5f5',
    bgTertiary: theme === 'dark' ? '#1f1f3a' : '#e5e5e5',
    textPrimary: theme === 'dark' ? '#fff' : '#1a1a2e',
    textSecondary: theme === 'dark' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)',
    textMuted: theme === 'dark' ? '#888' : '#666',
    border: theme === 'dark' ? '#333' : '#e0e0e0',
    borderLight: theme === 'dark' ? 'rgba(55,65,81,0.5)' : 'rgba(0,0,0,0.1)',
    gridLine: theme === 'dark' ? '#333' : '#ccc',
    axisText: theme === 'dark' ? '#888' : '#666',
    labelText: theme === 'dark' ? '#aaa' : '#555',
    d65Text: theme === 'dark' ? '#ccc' : '#444',
    d65Stroke: theme === 'dark' ? '#333' : '#999',
    snapshotLabel: theme === 'dark' ? '#888' : '#666',
    loadingBg: theme === 'dark' ? 'bg-gray-900/80' : 'bg-white/80',
    controlBg: theme === 'dark' ? 'bg-gray-800/90 hover:bg-gray-700' : 'bg-white/90 hover:bg-gray-100',
    controlBorder: theme === 'dark' ? 'border-gray-700/50' : 'border-gray-300/50',
    controlText: theme === 'dark' ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-900',
    kbdBg: theme === 'dark' ? 'bg-gray-800' : 'bg-gray-200',
    kbdText: theme === 'dark' ? 'text-gray-500' : 'text-gray-600',
    kbdBorder: theme === 'dark' ? 'border-gray-700' : 'border-gray-300',
    hintText: theme === 'dark' ? 'text-gray-600' : 'text-gray-500',
    spinnerBorder: theme === 'dark' ? 'border-blue-500/30' : 'border-blue-500/40',
    spinnerText: theme === 'dark' ? 'text-gray-400' : 'text-gray-600',
  }), [theme]);

  // Get diagram bounds based on mode
  const bounds = useMemo(() => {
    if (mode === 'CIE1931') {
      return { xMin: -0.05, xMax: 0.8, yMin: -0.05, yMax: 0.9 };
    } else {
      return { xMin: -0.02, xMax: 0.65, yMin: -0.02, yMax: 0.62 };
    }
  }, [mode]);

  // Convert spectral locus to current mode
  const spectralLocusData = useMemo(() => {
    return SPECTRAL_LOCUS_XY.map((point) => {
      const converted = convertToMode({ x: point.x, y: point.y }, mode);
      return {
        wavelength: point.wavelength,
        ...converted,
      };
    });
  }, [mode]);

  // Generate high-resolution locus data (1nm intervals) for smooth ridge animation
  const highResLocusData = useMemo(() => {
    return generateHighResolutionLocus(spectralLocusData, 1);
  }, [spectralLocusData]);

  // Calculate spectrum ridge data (Spectrum-on-Locus)
  // Each point on the locus gets extruded along its normal based on spectrum intensity
  // Uses high-resolution (1nm) locus data for smooth animation
  const spectrumRidgeData = useMemo(() => {
    if (!spectrum || spectrum.length === 0) return null;

    // Filter high-res locus points to visible spectrum range (380-700nm for meaningful display)
    const visibleLocus = highResLocusData.filter(
      (p) => p.wavelength >= 380 && p.wavelength <= 700
    );

    // Scale factor for ridge height (coordinate units) - apply intensityScale
    const ridgeScale = (mode === 'CIE1931' ? 0.08 : 0.06) * intensityScale;

    // Calculate ridge points
    const ridgePoints: { x: number; y: number; baseX: number; baseY: number; wavelength: number; intensity: number }[] = [];

    for (let i = 0; i < visibleLocus.length; i++) {
      const curr = visibleLocus[i];
      const prev = visibleLocus[Math.max(0, i - 1)];
      const next = visibleLocus[Math.min(visibleLocus.length - 1, i + 1)];

      const { nx, ny } = calculateNormal(prev, curr, next);
      const intensity = getSpectrumIntensityAtWavelength(spectrum, curr.wavelength, shiftNm);

      // Extrude point along normal based on intensity
      const extrudeDistance = intensity * ridgeScale;

      ridgePoints.push({
        baseX: curr.x,
        baseY: curr.y,
        x: curr.x + nx * extrudeDistance,
        y: curr.y + ny * extrudeDistance,
        wavelength: curr.wavelength,
        intensity,
      });
    }

    return ridgePoints;
  }, [highResLocusData, spectrum, shiftNm, mode, intensityScale]);

  // Current point in diagram coordinates
  const displayPoint = useMemo(() => {
    if (mode === 'CIE1976' && currentPointUV) {
      return { x: currentPointUV.u, y: currentPointUV.v };
    }
    return convertToMode(currentPoint, mode);
  }, [currentPoint, currentPointUV, mode]);

  // Keep displayPointRef in sync for zoom filter (avoids dependency in static useEffect)
  useEffect(() => {
    displayPointRef.current = displayPoint;
  }, [displayPoint]);

  // Snapshot points in diagram coordinates
  const snapshotPoints = useMemo(() => {
    return snapshots.map((s) => ({
      id: s.id,
      label: s.label,
      point:
        mode === 'CIE1976'
          ? { x: s.chromaticity.cie1976.u, y: s.chromaticity.cie1976.v }
          : { x: s.chromaticity.cie1931.x, y: s.chromaticity.cie1931.y },
      color: s.chromaticity.hexColor,
    }));
  }, [snapshots, mode]);

  // Gamut vertices in current mode
  const gamutData = useMemo(() => {
    return enabledGamuts.map((gamutKey) => {
      const gamut = COLOR_GAMUTS[gamutKey];
      const vertices = gamut.vertices.map((v) => convertToMode(v, mode));
      return {
        name: gamut.name,
        vertices,
        color: getGamutColor(gamutKey),
      };
    });
  }, [enabledGamuts, mode]);

  // Reset zoom to identity (Semantic Zoom: restore original scales)
  const handleResetZoom = useCallback(() => {
    if (!svgRef.current || !zoomRef.current || !baseScalesRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.transition().duration(300).call(zoomRef.current.transform, d3.zoomIdentity);
  }, []);

  // Handle axis range apply from modal
  // Independent axis scaling: directly modify scale domains instead of using d3-zoom transform
  const handleAxisRangeApply = useCallback((axis: 'x' | 'y', min: number, max: number) => {
    if (!svgRef.current || !scalesRef.current || !baseScalesRef.current) return;

    const svg = d3.select(svgRef.current);
    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;
    const margin = { top: 30, right: 30, bottom: 50, left: 50 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Copy current scales
    const currentXScale = scalesRef.current.xScale.copy();
    const currentYScale = scalesRef.current.yScale.copy();

    if (axis === 'x') {
      // Only change X axis domain, keep Y axis unchanged
      currentXScale.domain([min, max]);
    } else {
      // Only change Y axis domain, keep X axis unchanged
      currentYScale.domain([min, max]);
    }

    // Update scales reference
    scalesRef.current = { xScale: currentXScale, yScale: currentYScale };

    // Update axes with transition
    const xAxisGroup = svg.select<SVGGElement>('.x-axis');
    const yAxisGroup = svg.select<SVGGElement>('.y-axis');

    const xAxis = d3.axisBottom(currentXScale).ticks(8).tickSize(-innerHeight);
    const yAxis = d3.axisLeft(currentYScale).ticks(8).tickSize(-innerWidth);

    xAxisGroup
      .transition()
      .duration(300)
      .call(xAxis)
      .call((g) => g.select('.domain').remove())
      .call((g) => g.selectAll('.tick line').attr('stroke', themeColors.gridLine).attr('stroke-dasharray', '2,2'))
      .call((g) => g.selectAll('.tick text').attr('fill', themeColors.axisText).attr('font-size', '10px'));

    yAxisGroup
      .transition()
      .duration(300)
      .call(yAxis)
      .call((g) => g.select('.domain').remove())
      .call((g) => g.selectAll('.tick line').attr('stroke', themeColors.gridLine).attr('stroke-dasharray', '2,2'))
      .call((g) => g.selectAll('.tick text').attr('fill', themeColors.axisText).attr('font-size', '10px'));

    // Update static elements with new scales
    const updateStaticElementsForAxisChange = () => {
      const staticGroup = svg.select('.main-group .static-group');

      // Update spectral locus paths
      const locusPath = d3
        .line<{ x: number; y: number }>()
        .x((d) => currentXScale(d.x))
        .y((d) => currentYScale(d.y))
        .curve(d3.curveCatmullRom.alpha(0.5));

      // Generate high-resolution locus for smooth boundary rendering
      const highResLocus = generateHighResolutionLocus(spectralLocusData, 1);
      const closedLocusData = [...highResLocus, highResLocus[0]];

      // Update filled horseshoe path and outline
      const allPaths = staticGroup.selectAll('path').nodes() as SVGPathElement[];
      allPaths.forEach((pathEl, i) => {
        const path = d3.select(pathEl);
        if (i === 0) {
          path.datum(closedLocusData).transition().duration(300).attr('d', locusPath);
        } else if (i === 1) {
          path.datum(highResLocus).transition().duration(300).attr('d', locusPath);
        }
      });

      // Update purple line
      const purpleLine = [spectralLocusData[0], spectralLocusData[spectralLocusData.length - 1]];
      staticGroup.select('line')
        .transition()
        .duration(300)
        .attr('x1', currentXScale(purpleLine[0].x))
        .attr('y1', currentYScale(purpleLine[0].y))
        .attr('x2', currentXScale(purpleLine[1].x))
        .attr('y2', currentYScale(purpleLine[1].y));

      // Update wavelength labels
      const wavelengthLabels = staticGroup.select('.wavelength-labels').selectAll('text').nodes() as SVGTextElement[];
      wavelengthLabels.forEach((textEl) => {
        const text = d3.select(textEl);
        const wavelengthText = text.text();
        const wavelength = parseInt(wavelengthText);

        const point = spectralLocusData.find((p) => p.wavelength === wavelength);
        if (point) {
          const idx = spectralLocusData.findIndex((p) => p.wavelength === wavelength);
          const prev = spectralLocusData[Math.max(0, idx - 1)];
          const next = spectralLocusData[Math.min(spectralLocusData.length - 1, idx + 1)];

          const dx = next.x - prev.x;
          const dy = next.y - prev.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          const offsetX = (-dy / len) * 0.04;
          const offsetY = (dx / len) * 0.04;

          text
            .transition()
            .duration(300)
            .attr('x', currentXScale(point.x + offsetX))
            .attr('y', currentYScale(point.y + offsetY));
        }
      });

      // Update gamut triangles
      let gamutIndex = 0;
      gamutData.forEach((gamut) => {
        const trianglePath = d3
          .line<{ x: number; y: number }>()
          .x((d) => currentXScale(d.x))
          .y((d) => currentYScale(d.y));

        const closedVertices = [...gamut.vertices, gamut.vertices[0]];
        const gamutPathIndex = 2 + gamutIndex;
        if (allPaths[gamutPathIndex]) {
          d3.select(allPaths[gamutPathIndex])
            .datum(closedVertices)
            .transition()
            .duration(300)
            .attr('d', trianglePath);
        }

        // Update centroid text
        const centroid = {
          x: gamut.vertices.reduce((sum, v) => sum + v.x, 0) / 3,
          y: gamut.vertices.reduce((sum, v) => sum + v.y, 0) / 3,
        };

        const allTextNodes = staticGroup.selectAll('text').nodes() as SVGTextElement[];
        allTextNodes.forEach((textNode) => {
          const textEl = d3.select(textNode);
          if (textEl.text() === gamut.name) {
            textEl
              .transition()
              .duration(300)
              .attr('x', currentXScale(centroid.x))
              .attr('y', currentYScale(centroid.y));
          }
        });

        gamutIndex++;
      });

      // Update D65 white point
      const d65 = mode === 'CIE1976' ? { x: 0.1978, y: 0.4683 } : { x: 0.3127, y: 0.329 };
      const circles = staticGroup.selectAll('circle').nodes() as SVGCircleElement[];
      circles.forEach((circleEl) => {
        const circle = d3.select(circleEl);
        circle
          .transition()
          .duration(300)
          .attr('cx', currentXScale(d65.x))
          .attr('cy', currentYScale(d65.y));
      });

      // Update D65 label
      const textNodes = staticGroup.selectAll('text').nodes() as SVGTextElement[];
      textNodes.forEach((textNode) => {
        const textEl = d3.select(textNode);
        if (textEl.text() === 'D65') {
          textEl
            .transition()
            .duration(300)
            .attr('x', currentXScale(d65.x) + 8)
            .attr('y', currentYScale(d65.y) + 4);
        }
      });
    };

    updateStaticElementsForAxisChange();

    // Trigger re-render of dynamic elements
    setTimeout(() => {
      setZoomTrigger(prev => prev + 1);
    }, 300);

    // Calculate approximate zoom level for display (use the larger scale factor)
    const baseXDomain = baseScalesRef.current.xScale.domain();
    const baseYDomain = baseScalesRef.current.yScale.domain();
    const xZoom = (baseXDomain[1] - baseXDomain[0]) / (max - min);
    const yZoom = (baseYDomain[1] - baseYDomain[0]) / (currentYScale.domain()[1] - currentYScale.domain()[0]);

    if (axis === 'x') {
      setZoomLevel(xZoom);
    } else {
      setZoomLevel(yZoom);
    }

    // Notify parent of zoom/axis change
    if (onZoomChange) {
      // Since we're now using independent axis scaling, report an approximate transform
      const avgZoom = (axis === 'x' ? xZoom : yZoom);
      onZoomChange({ k: avgZoom, x: 0, y: 0 });
    }

    // Notify parent of custom axis range change
    if (onAxisRangeChange) {
      const newRanges = { ...customAxisRanges };
      newRanges[axis] = { min, max };
      onAxisRangeChange(newRanges);
    }
  }, [customAxisRanges, onAxisRangeChange, spectralLocusData, gamutData, mode, themeColors, onZoomChange]);

  // Set loading state when dependencies change (before the main effect runs)
  // This is intentional for D3.js diagram initialization UX
  useEffect(() => {
     
    setIsLoading(true);
  }, [bounds, mode]);

  // ============================================
  // STATIC ELEMENTS RENDERING (runs once per mode/gamut change)
  // Note: displayPoint is intentionally NOT in dependencies to preserve zoom state
  // ============================================
  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;
    const margin = { top: 30, right: 30, bottom: 50, left: 50 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Clear all content only when mode/bounds change
    svg.selectAll('*').remove();
    staticRenderedRef.current = false;

    // Create scales and store in ref for dynamic updates
    // Base scales are the original (unzoomed) scales
    const xScale = d3
      .scaleLinear()
      .domain([bounds.xMin, bounds.xMax])
      .range([margin.left, margin.left + innerWidth]);

    const yScale = d3
      .scaleLinear()
      .domain([bounds.yMin, bounds.yMax])
      .range([margin.top + innerHeight, margin.top]);

    // Store both base and current scales
    baseScalesRef.current = { xScale: xScale.copy(), yScale: yScale.copy() };
    scalesRef.current = { xScale: xScale.copy(), yScale: yScale.copy() };

    // Background
    svg
      .append('rect')
      .attr('class', 'background')
      .attr('width', width)
      .attr('height', height)
      .attr('fill', themeColors.bgSecondary);

    // Create defs for gradients and filters
    const defs = svg.append('defs');

    // Create gradient for spectral locus
    const gradient = defs
      .append('linearGradient')
      .attr('id', 'spectral-gradient')
      .attr('gradientUnits', 'userSpaceOnUse');

    SPECTRAL_LOCUS_XY.forEach((point, i) => {
      gradient
        .append('stop')
        .attr('offset', `${(i / (SPECTRAL_LOCUS_XY.length - 1)) * 100}%`)
        .attr('stop-color', wavelengthToRGB(point.wavelength));
    });

    // Add clip path for zoom/pan bounds (prevents content from overflowing into axis area)
    defs.append('clipPath')
      .attr('id', 'chart-clip')
      .append('rect')
      .attr('x', margin.left)
      .attr('y', margin.top)
      .attr('width', innerWidth)
      .attr('height', innerHeight);

    // Add glow filter (used by dynamic elements)
    const glowFilter = defs
      .append('filter')
      .attr('id', 'glow-filter')
      .attr('x', '-50%')
      .attr('y', '-50%')
      .attr('width', '200%')
      .attr('height', '200%');

    glowFilter
      .append('feGaussianBlur')
      .attr('stdDeviation', '4')
      .attr('result', 'coloredBlur');

    const glowMerge = glowFilter.append('feMerge');
    glowMerge.append('feMergeNode').attr('in', 'coloredBlur');
    glowMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    // Create static group
    const staticGroup = svg.append('g').attr('class', 'static-group');

    // Generate high-resolution locus for smooth boundary rendering
    const highResLocus = generateHighResolutionLocus(spectralLocusData, 1);

    // Draw filled horseshoe shape
    const locusPath = d3
      .line<{ x: number; y: number }>()
      .x((d) => xScale(d.x))
      .y((d) => yScale(d.y))
      .curve(d3.curveCatmullRom.alpha(0.5));

    const closedLocusData = [...highResLocus, highResLocus[0]];

    staticGroup
      .append('path')
      .datum(closedLocusData)
      .attr('d', locusPath)
      .attr('fill', 'url(#spectral-gradient)')
      .attr('fill-opacity', 0.15)
      .attr('stroke', 'none');

    staticGroup
      .append('path')
      .datum(highResLocus)
      .attr('d', locusPath)
      .attr('fill', 'none')
      .attr('stroke', 'url(#spectral-gradient)')
      .attr('stroke-width', 2)
      .attr('stroke-linecap', 'round');

    // Purple line
    const purpleLine = [spectralLocusData[0], spectralLocusData[spectralLocusData.length - 1]];
    staticGroup
      .append('line')
      .attr('x1', xScale(purpleLine[0].x))
      .attr('y1', yScale(purpleLine[0].y))
      .attr('x2', xScale(purpleLine[1].x))
      .attr('y2', yScale(purpleLine[1].y))
      .attr('stroke', '#8b5cf6')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '6,4');

    // Wavelength labels
    const labelWavelengths = [380, 420, 460, 480, 500, 520, 540, 560, 580, 600, 620, 650, 700];
    const labelsGroup = staticGroup.append('g').attr('class', 'wavelength-labels');

    spectralLocusData
      .filter((d) => labelWavelengths.includes(d.wavelength))
      .forEach((d) => {
        const idx = spectralLocusData.findIndex((p) => p.wavelength === d.wavelength);
        const prev = spectralLocusData[Math.max(0, idx - 1)];
        const next = spectralLocusData[Math.min(spectralLocusData.length - 1, idx + 1)];

        const dx = next.x - prev.x;
        const dy = next.y - prev.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        const offsetX = (-dy / len) * 0.04;
        const offsetY = (dx / len) * 0.04;

        labelsGroup
          .append('text')
          .attr('x', xScale(d.x + offsetX))
          .attr('y', yScale(d.y + offsetY))
          .attr('fill', wavelengthToRGB(d.wavelength))
          .attr('font-size', '10px')
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'middle')
          .text(`${d.wavelength}`);
      });

    // Gamut triangles
    gamutData.forEach((gamut) => {
      const trianglePath = d3
        .line<{ x: number; y: number }>()
        .x((d) => xScale(d.x))
        .y((d) => yScale(d.y));

      const closedVertices = [...gamut.vertices, gamut.vertices[0]];

      staticGroup
        .append('path')
        .datum(closedVertices)
        .attr('d', trianglePath)
        .attr('fill', gamut.color)
        .attr('fill-opacity', 0.1)
        .attr('stroke', gamut.color)
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '8,4');

      const centroid = {
        x: gamut.vertices.reduce((sum, v) => sum + v.x, 0) / 3,
        y: gamut.vertices.reduce((sum, v) => sum + v.y, 0) / 3,
      };

      staticGroup
        .append('text')
        .attr('x', xScale(centroid.x))
        .attr('y', yScale(centroid.y))
        .attr('fill', gamut.color)
        .attr('font-size', '11px')
        .attr('text-anchor', 'middle')
        .attr('font-weight', 'bold')
        .attr('opacity', 0.8)
        .text(gamut.name);
    });

    // D65 white point
    const d65 = mode === 'CIE1976' ? { x: 0.1978, y: 0.4683 } : { x: 0.3127, y: 0.329 };

    staticGroup
      .append('circle')
      .attr('cx', xScale(d65.x))
      .attr('cy', yScale(d65.y))
      .attr('r', 4)
      .attr('fill', theme === 'dark' ? 'white' : '#333')
      .attr('stroke', themeColors.d65Stroke)
      .attr('stroke-width', 1);

    staticGroup
      .append('text')
      .attr('x', xScale(d65.x) + 8)
      .attr('y', yScale(d65.y) + 4)
      .attr('fill', themeColors.d65Text)
      .attr('font-size', '10px')
      .text('D65');

    // Axes
    const xAxis = d3.axisBottom(xScale).ticks(8).tickSize(-innerHeight);
    const yAxis = d3.axisLeft(yScale).ticks(8).tickSize(-innerWidth);

    // X-axis with double-click to set range
    const xAxisGroup = svg
      .append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${margin.top + innerHeight})`)
      .call(xAxis)
      .call((g) => g.select('.domain').remove())
      .call((g) => g.selectAll('.tick line').attr('stroke', themeColors.gridLine).attr('stroke-dasharray', '2,2'))
      .call((g) => g.selectAll('.tick text').attr('fill', themeColors.axisText).attr('font-size', '10px'));

    // Add invisible rect for X-axis click area
    xAxisGroup
      .append('rect')
      .attr('class', 'x-axis-clickable')
      .attr('x', 0)
      .attr('y', -10)
      .attr('width', innerWidth)
      .attr('height', 40)
      .attr('fill', 'transparent')
      .style('cursor', 'pointer')
      .on('dblclick', (event: MouseEvent) => {
        event.stopPropagation();
        if (scalesRef.current) {
          const [min, max] = scalesRef.current.xScale.domain();
           
          setAxisRangeModal({ isOpen: true, axis: 'x', min, max });
        }
      });

    // Y-axis with double-click to set range
    const yAxisGroup = svg
      .append('g')
      .attr('class', 'y-axis')
      .attr('transform', `translate(${margin.left},0)`)
      .call(yAxis)
      .call((g) => g.select('.domain').remove())
      .call((g) => g.selectAll('.tick line').attr('stroke', themeColors.gridLine).attr('stroke-dasharray', '2,2'))
      .call((g) => g.selectAll('.tick text').attr('fill', themeColors.axisText).attr('font-size', '10px'));

    // Add invisible rect for Y-axis click area
    yAxisGroup
      .append('rect')
      .attr('class', 'y-axis-clickable')
      .attr('x', -40)
      .attr('y', margin.top)
      .attr('width', 40)
      .attr('height', innerHeight)
      .attr('fill', 'transparent')
      .style('cursor', 'pointer')
      .on('dblclick', (event: MouseEvent) => {
        event.stopPropagation();
        if (scalesRef.current) {
          const [min, max] = scalesRef.current.yScale.domain();
           
          setAxisRangeModal({ isOpen: true, axis: 'y', min, max });
        }
      });

    // Axis labels
    svg
      .append('text')
      .attr('class', 'axis-label-x')
      .attr('x', margin.left + innerWidth / 2)
      .attr('y', height - 10)
      .attr('fill', themeColors.labelText)
      .attr('font-size', '12px')
      .attr('text-anchor', 'middle')
      .text(mode === 'CIE1931' ? 'x' : "u'");

    svg
      .append('text')
      .attr('class', 'axis-label-y')
      .attr('x', 15)
      .attr('y', margin.top + innerHeight / 2)
      .attr('fill', themeColors.labelText)
      .attr('font-size', '12px')
      .attr('text-anchor', 'middle')
      .attr('transform', `rotate(-90, 15, ${margin.top + innerHeight / 2})`)
      .text(mode === 'CIE1931' ? 'y' : "v'");

    // Mode indicator
    svg
      .append('text')
      .attr('class', 'mode-indicator')
      .attr('x', width - margin.right)
      .attr('y', margin.top)
      .attr('fill', themeColors.textMuted)
      .attr('font-size', '11px')
      .attr('text-anchor', 'end')
      .text(mode === 'CIE1931' ? 'CIE 1931 xy' : "CIE 1976 u'v'");

    // Create a main content group with clip-path
    // Semantic Zoom: No CSS transform on main-group, elements are re-rendered with new scales
    const mainGroup = svg.append('g')
      .attr('class', 'main-group')
      .attr('clip-path', 'url(#chart-clip)');

    // Move static group into main group (static elements will be re-rendered on zoom)
    const existingStaticContent = staticGroup.node();
    if (existingStaticContent) {
      mainGroup.node()?.appendChild(existingStaticContent);
    }

    // Create dynamic group (for elements that update frequently)
    mainGroup.append('g').attr('class', 'dynamic-group');

    // Create groups for snapshots and current point (rendered above ridge)
    mainGroup.append('g').attr('class', 'snapshots-group');
    mainGroup.append('g').attr('class', 'current-point-group');

    // Create tooltip group (outside main group so it doesn't clip)
    svg.append('g').attr('class', 'tooltip-group');

    // ============================================
    // ZOOM BEHAVIOR SETUP (Semantic Zoom)
    // ============================================
    // Semantic Zoom: Instead of CSS transform, we rescale the axes and re-render elements
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 50]) // Allow zoom from 50% to 5000%
      .filter((event: MouseEvent | WheelEvent | TouchEvent) => {
        // Only allow wheel events for zoom
        // Pan (mousedown/touchstart) is completely disabled
        // - Axis double-click provides range setting functionality
        // - Ridge drag is handled separately and is not affected
        if (event.type === 'wheel') return true;
        // Block all mouse/touch drag for pan (disabled by design)
        return false;
      })
      .on('zoom', (event) => {
        const transform = event.transform as ZoomTransform;
        currentTransformRef.current = transform;
        setZoomLevel(transform.k);

        // Notify parent of zoom change for session persistence
        onZoomChange?.({ k: transform.k, x: transform.x, y: transform.y });

        // Semantic Zoom: Rescale axes based on transform
        if (baseScalesRef.current) {
          const newXScale = transform.rescaleX(baseScalesRef.current.xScale);
          const newYScale = transform.rescaleY(baseScalesRef.current.yScale);

          // Update current scales ref
          scalesRef.current = { xScale: newXScale, yScale: newYScale };

          // Update axes with new scales
          const xAxisGroup = svg.select<SVGGElement>('.x-axis');
          const yAxisGroup = svg.select<SVGGElement>('.y-axis');

          const xAxis = d3.axisBottom(newXScale).ticks(8).tickSize(-innerHeight);
          const yAxis = d3.axisLeft(newYScale).ticks(8).tickSize(-innerWidth);

          xAxisGroup
            .call(xAxis)
            .call((g) => g.select('.domain').remove())
            .call((g) => g.selectAll('.tick line').attr('stroke', themeColors.gridLine).attr('stroke-dasharray', '2,2'))
            .call((g) => g.selectAll('.tick text').attr('fill', themeColors.axisText).attr('font-size', '10px'));

          yAxisGroup
            .call(yAxis)
            .call((g) => g.select('.domain').remove())
            .call((g) => g.selectAll('.tick line').attr('stroke', themeColors.gridLine).attr('stroke-dasharray', '2,2'))
            .call((g) => g.selectAll('.tick text').attr('fill', themeColors.axisText).attr('font-size', '10px'));

          // Update static elements with new scales (Semantic Zoom)
          updateStaticElements(svg, newXScale, newYScale);

          // Trigger re-render of dynamic elements with new scales
           
          setZoomTrigger(prev => prev + 1);
        }
      });

    // Helper function to update static elements on zoom
    function updateStaticElements(
      svgSelection: d3.Selection<SVGSVGElement, unknown, null, undefined>,
      newXScale: d3.ScaleLinear<number, number>,
      newYScale: d3.ScaleLinear<number, number>
    ) {
      const staticGroup = svgSelection.select('.main-group .static-group');

      // Update spectral locus paths
      const locusPath = d3
        .line<{ x: number; y: number }>()
        .x((d) => newXScale(d.x))
        .y((d) => newYScale(d.y))
        .curve(d3.curveCatmullRom.alpha(0.5));

      // Generate high-resolution locus for smooth boundary rendering
      const highResLocus = generateHighResolutionLocus(spectralLocusData, 1);
      const closedLocusData = [...highResLocus, highResLocus[0]];

      // Update filled horseshoe path and outline using nodes()
      const allPaths = staticGroup.selectAll('path').nodes() as SVGPathElement[];
      allPaths.forEach((pathEl, i) => {
        const path = d3.select(pathEl);
        if (i === 0) {
          // Filled path
          path.datum(closedLocusData).attr('d', locusPath);
        } else if (i === 1) {
          // Outline path
          path.datum(highResLocus).attr('d', locusPath);
        }
      });

      // Update purple line
      const purpleLine = [spectralLocusData[0], spectralLocusData[spectralLocusData.length - 1]];
      staticGroup.select('line')
        .attr('x1', newXScale(purpleLine[0].x))
        .attr('y1', newYScale(purpleLine[0].y))
        .attr('x2', newXScale(purpleLine[1].x))
        .attr('y2', newYScale(purpleLine[1].y));

      // Update wavelength labels
      const wavelengthLabels = staticGroup.select('.wavelength-labels').selectAll('text').nodes() as SVGTextElement[];
      wavelengthLabels.forEach((textEl) => {
        const text = d3.select(textEl);
        const wavelengthText = text.text();
        const wavelength = parseInt(wavelengthText);

        const point = spectralLocusData.find((p) => p.wavelength === wavelength);
        if (point) {
          const idx = spectralLocusData.findIndex((p) => p.wavelength === wavelength);
          const prev = spectralLocusData[Math.max(0, idx - 1)];
          const next = spectralLocusData[Math.min(spectralLocusData.length - 1, idx + 1)];

          const dx = next.x - prev.x;
          const dy = next.y - prev.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          const offsetX = (-dy / len) * 0.04;
          const offsetY = (dx / len) * 0.04;

          text
            .attr('x', newXScale(point.x + offsetX))
            .attr('y', newYScale(point.y + offsetY));
        }
      });

      // Update gamut triangles - need to re-select and update each
      let gamutIndex = 0;
      gamutData.forEach((gamut) => {
        const trianglePath = d3
          .line<{ x: number; y: number }>()
          .x((d) => newXScale(d.x))
          .y((d) => newYScale(d.y));

        const closedVertices = [...gamut.vertices, gamut.vertices[0]];

        // Update triangle path (every other path after locus paths and before other elements)
        // Gamut paths start after the 2 locus paths
        const gamutPathIndex = 2 + gamutIndex;
        if (allPaths[gamutPathIndex]) {
          d3.select(allPaths[gamutPathIndex])
            .datum(closedVertices)
            .attr('d', trianglePath);
        }

        // Update centroid text
        const centroid = {
          x: gamut.vertices.reduce((sum, v) => sum + v.x, 0) / 3,
          y: gamut.vertices.reduce((sum, v) => sum + v.y, 0) / 3,
        };

        // Find the gamut label text
        const allTextNodes = staticGroup.selectAll('text').nodes() as SVGTextElement[];
        allTextNodes.forEach((textNode) => {
          const textEl = d3.select(textNode);
          if (textEl.text() === gamut.name) {
            textEl
              .attr('x', newXScale(centroid.x))
              .attr('y', newYScale(centroid.y));
          }
        });

        gamutIndex++;
      });

      // Update D65 white point
      const d65 = mode === 'CIE1976' ? { x: 0.1978, y: 0.4683 } : { x: 0.3127, y: 0.329 };
      const circles = staticGroup.selectAll('circle').nodes() as SVGCircleElement[];
      circles.forEach((circleEl) => {
        const circle = d3.select(circleEl);
        // D65 is a small circle
        circle
          .attr('cx', newXScale(d65.x))
          .attr('cy', newYScale(d65.y));
      });

      // Update D65 label
      const textNodes = staticGroup.selectAll('text').nodes() as SVGTextElement[];
      textNodes.forEach((textNode) => {
        const textEl = d3.select(textNode);
        if (textEl.text() === 'D65') {
          textEl
            .attr('x', newXScale(d65.x) + 8)
            .attr('y', newYScale(d65.y) + 4);
        }
      });
    }

    svg.call(zoom);
    zoomRef.current = zoom;

    // Apply initial zoom transform if provided, otherwise reset
    if (initialZoomTransform) {
      const savedTransform = d3.zoomIdentity
        .translate(initialZoomTransform.x, initialZoomTransform.y)
        .scale(initialZoomTransform.k);
      svg.call(zoom.transform, savedTransform);
      currentTransformRef.current = savedTransform;
       
      setZoomLevel(initialZoomTransform.k);
    } else {
      // Reset transform on mode change
      svg.call(zoom.transform, d3.zoomIdentity);
      currentTransformRef.current = d3.zoomIdentity;
       
      setZoomLevel(1);
    }
     
    setZoomTrigger(0);

    staticRenderedRef.current = true;

    // Mark loading complete after a brief delay for smooth transition
    requestAnimationFrame(() => {
      setIsLoading(false);
    });
  // Note: displayPoint is intentionally excluded from dependencies to preserve zoom state during wavelength shifts
  // displayPointRef is used in zoom filter instead
  // initialZoomTransform and onZoomChange are also excluded to prevent re-render loops
  }, [bounds, spectralLocusData, gamutData, mode, theme, themeColors]);

  // ============================================
  // DYNAMIC ELEMENTS RENDERING (runs on spectrum/point changes)
  // Uses D3 enter/update/exit pattern for efficiency
  // ============================================
  useEffect(() => {
    if (!svgRef.current || !scalesRef.current || !staticRenderedRef.current) return;

    const svg = d3.select(svgRef.current);
    const { xScale, yScale } = scalesRef.current;
    const defs = svg.select('defs');
    const dynamicGroup = svg.select('.main-group .dynamic-group');

    // Clear only dynamic content (not static elements!)
    dynamicGroup.selectAll('*').remove();
    defs.select('#ridge-gradient').remove();

    // Draw Spectrum Ridge if available
    if (spectrumRidgeData && spectrumRidgeData.length > 0) {
      const ridgeAreaData: { x: number; y: number }[] = [];

      spectrumRidgeData.forEach((p) => {
        ridgeAreaData.push({ x: p.x, y: p.y });
      });

      for (let i = spectrumRidgeData.length - 1; i >= 0; i--) {
        ridgeAreaData.push({
          x: spectrumRidgeData[i].baseX,
          y: spectrumRidgeData[i].baseY,
        });
      }

      const ridgePath = d3
        .line<{ x: number; y: number }>()
        .x((d) => xScale(d.x))
        .y((d) => yScale(d.y))
        .curve(d3.curveBasis);

      // Ridge gradient
      const ridgeGradient = defs
        .append('linearGradient')
        .attr('id', 'ridge-gradient')
        .attr('gradientUnits', 'userSpaceOnUse')
        .attr('x1', xScale(spectrumRidgeData[0].baseX))
        .attr('y1', yScale(spectrumRidgeData[0].baseY))
        .attr('x2', xScale(spectrumRidgeData[spectrumRidgeData.length - 1].baseX))
        .attr('y2', yScale(spectrumRidgeData[spectrumRidgeData.length - 1].baseY));

      spectrumRidgeData.forEach((p, i) => {
        if (p.intensity > 0.01) {
          ridgeGradient
            .append('stop')
            .attr('offset', `${(i / (spectrumRidgeData.length - 1)) * 100}%`)
            .attr('stop-color', wavelengthToRGB(p.wavelength))
            .attr('stop-opacity', 0.3 + p.intensity * 0.5);
        }
      });

      const ridgeGroup = dynamicGroup.append('g').attr('class', 'spectrum-ridge');

      // Ridge fill with hover highlight effect
      ridgeGroup
        .append('path')
        .datum(ridgeAreaData)
        .attr('d', ridgePath)
        .attr('fill', 'url(#ridge-gradient)')
        .attr('fill-opacity', isHoveringRidge ? 0.8 : 0.6)
        .attr('stroke', isHoveringRidge ? 'rgba(255,255,255,0.3)' : 'none')
        .attr('stroke-width', isHoveringRidge ? 2 : 0)
        .attr('class', 'ridge-fill')
        .style('cursor', 'ew-resize')
        .style('transition', 'fill-opacity 0.15s ease, stroke 0.15s ease');

      // Ridge outline
      const ridgeTopPoints = spectrumRidgeData.map((p) => ({ x: p.x, y: p.y }));

      ridgeGroup
        .append('path')
        .datum(ridgeTopPoints)
        .attr('d', ridgePath)
        .attr('fill', 'none')
        .attr('stroke', hexColor)
        .attr('stroke-width', isHoveringRidge ? 3 : 2)
        .attr('stroke-opacity', isHoveringRidge ? 1 : 0.8)
        .attr('class', 'ridge-outline')
        .style('cursor', 'ew-resize')
        .style('transition', 'stroke-width 0.15s ease, stroke-opacity 0.15s ease');

      // Peak glow - use interpolated position for smooth movement
      // Find the discrete peak for intensity threshold check
      const discretePeakPoint = spectrumRidgeData.reduce((max, p) =>
        p.intensity > max.intensity ? p : max
      );

      if (discretePeakPoint.intensity > 0.1 && spectrum && spectrum.length > 0) {
        // Calculate precise peak wavelength using parabolic interpolation
        const preciseWavelength = findInterpolatedPeakWavelength(spectrum, shiftNm);

        // Get interpolated position on the locus
        const interpolatedPos = interpolateLocusPosition(
          preciseWavelength,
          spectralLocusData
        );

        if (interpolatedPos) {
          // Get intensity at the precise wavelength for extrude distance
          const preciseIntensity = getSpectrumIntensityAtWavelength(
            spectrum,
            preciseWavelength,
            shiftNm
          );

          // Calculate extrude distance (same scale as ridge) - apply intensityScale
          const ridgeScale = (mode === 'CIE1931' ? 0.08 : 0.06) * intensityScale;
          const extrudeDistance = preciseIntensity * ridgeScale;

          // Calculate peak position with extrude
          const peakX = interpolatedPos.x + interpolatedPos.nx * extrudeDistance;
          const peakY = interpolatedPos.y + interpolatedPos.ny * extrudeDistance;

          ridgeGroup
            .append('circle')
            .attr('cx', xScale(peakX))
            .attr('cy', yScale(peakY))
            .attr('r', isHoveringRidge ? 16 : 12)
            .attr('fill', hexColor)
            .attr('opacity', isHoveringRidge ? 0.4 : 0.3)
            .attr('filter', 'url(#glow-filter)')
            .style('pointer-events', 'none')
            .style('transition', 'r 0.15s ease, opacity 0.15s ease');
        }
      }
    }

    // Update snapshots
    const snapshotsGroup = svg.select('.main-group .snapshots-group');
    snapshotsGroup.selectAll('*').remove();

    snapshotPoints.forEach((snapshot, idx) => {
      snapshotsGroup
        .append('circle')
        .attr('cx', xScale(snapshot.point.x))
        .attr('cy', yScale(snapshot.point.y))
        .attr('r', 6)
        .attr('fill', snapshot.color)
        .attr('stroke', '#fff')
        .attr('stroke-width', 1.5)
        .attr('opacity', 0.7);

      snapshotsGroup
        .append('text')
        .attr('x', xScale(snapshot.point.x) + 10)
        .attr('y', yScale(snapshot.point.y) + 4)
        .attr('fill', themeColors.snapshotLabel)
        .attr('font-size', '9px')
        .text(snapshot.label || `#${idx + 1}`);
    });

    // Update current point
    const currentPointGroup = svg.select('.main-group .current-point-group');
    currentPointGroup.selectAll('*').remove();

    // Glow effect
    currentPointGroup
      .append('circle')
      .attr('cx', xScale(displayPoint.x))
      .attr('cy', yScale(displayPoint.y))
      .attr('r', 16)
      .attr('fill', hexColor)
      .attr('opacity', 0.3)
      .attr('filter', 'blur(4px)');

    // Main point
    currentPointGroup
      .append('circle')
      .attr('cx', xScale(displayPoint.x))
      .attr('cy', yScale(displayPoint.y))
      .attr('r', 8)
      .attr('fill', hexColor)
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .attr('cursor', 'grab');

    // Inner highlight
    currentPointGroup
      .append('circle')
      .attr('cx', xScale(displayPoint.x) - 2)
      .attr('cy', yScale(displayPoint.y) - 2)
      .attr('r', 2)
      .attr('fill', 'rgba(255,255,255,0.6)');

    // Update tooltip for drag delta - use interpolated position for smooth tracking
    const tooltipGroup = svg.select('.tooltip-group');
    tooltipGroup.selectAll('*').remove();

    if (dragDelta !== null && spectrumRidgeData && spectrumRidgeData.length > 0 && spectrum && spectrum.length > 0) {
      // Calculate precise peak position for tooltip
      const preciseWavelength = findInterpolatedPeakWavelength(spectrum, shiftNm);
      const interpolatedPos = interpolateLocusPosition(
        preciseWavelength,
        spectralLocusData
      );

      if (interpolatedPos) {
        const preciseIntensity = getSpectrumIntensityAtWavelength(
          spectrum,
          preciseWavelength,
          shiftNm
        );
        const ridgeScale = (mode === 'CIE1931' ? 0.08 : 0.06) * intensityScale;
        const extrudeDistance = preciseIntensity * ridgeScale;

        const peakX = interpolatedPos.x + interpolatedPos.nx * extrudeDistance;
        const peakY = interpolatedPos.y + interpolatedPos.ny * extrudeDistance;

        const tooltipX = xScale(peakX);
        const tooltipY = yScale(peakY) - 25;

        // Tooltip background
        tooltipGroup
          .append('rect')
          .attr('x', tooltipX - 35)
          .attr('y', tooltipY - 12)
          .attr('width', 70)
          .attr('height', 20)
          .attr('rx', 4)
          .attr('fill', 'rgba(0,0,0,0.8)')
          .attr('stroke', hexColor)
          .attr('stroke-width', 1);

        // Tooltip text
        const sign = dragDelta >= 0 ? '+' : '';
        tooltipGroup
          .append('text')
          .attr('x', tooltipX)
          .attr('y', tooltipY + 2)
          .attr('fill', '#fff')
          .attr('font-size', '11px')
          .attr('font-weight', 'bold')
          .attr('text-anchor', 'middle')
          .text(`Δλ: ${sign}${Math.round(dragDelta)}nm`);
      }
    }
  }, [spectrumRidgeData, displayPoint, snapshotPoints, hexColor, isHoveringRidge, dragDelta, spectrum, shiftNm, spectralLocusData, mode, themeColors, zoomTrigger, intensityScale]);

  // ============================================
  // DRAG HANDLERS with requestAnimationFrame
  // ============================================
  const isInsideRidge = useCallback(
    (mouseX: number, mouseY: number): boolean => {
      if (!spectrumRidgeData || spectrumRidgeData.length === 0 || !scalesRef.current) return false;

      const { xScale, yScale } = scalesRef.current;

      // Larger touch targets for mobile (minimum 44px recommended)
      const touchPadding = 22; // 44px / 2 for radius
      const boundsPadding = 15;

      const ridgeMinX = Math.min(...spectrumRidgeData.map((p) => Math.min(xScale(p.x), xScale(p.baseX)))) - boundsPadding;
      const ridgeMaxX = Math.max(...spectrumRidgeData.map((p) => Math.max(xScale(p.x), xScale(p.baseX)))) + boundsPadding;
      const ridgeMinY = Math.min(...spectrumRidgeData.map((p) => Math.min(yScale(p.y), yScale(p.baseY)))) - boundsPadding;
      const ridgeMaxY = Math.max(...spectrumRidgeData.map((p) => Math.max(yScale(p.y), yScale(p.baseY)))) + boundsPadding;

      if (mouseX < ridgeMinX || mouseX > ridgeMaxX || mouseY < ridgeMinY || mouseY > ridgeMaxY) {
        return false;
      }

      for (let i = 0; i < spectrumRidgeData.length; i++) {
        const p = spectrumRidgeData[i];
        const px = xScale(p.x);
        const py = yScale(p.y);
        const bx = xScale(p.baseX);
        const by = yScale(p.baseY);

        const distToTop = Math.sqrt(Math.pow(mouseX - px, 2) + Math.pow(mouseY - py, 2));
        const distToBase = Math.sqrt(Math.pow(mouseX - bx, 2) + Math.pow(mouseY - by, 2));

        // Use larger touch targets
        if (distToTop < touchPadding || distToBase < touchPadding) return true;

        if (p.intensity > 0.05) {
          const midX = (px + bx) / 2;
          const midY = (py + by) / 2;
          const distToMid = Math.sqrt(Math.pow(mouseX - midX, 2) + Math.pow(mouseY - midY, 2));
          if (distToMid < touchPadding + 5) return true;
        }
      }

      return false;
    },
    [spectrumRidgeData]
  );

  const isNearCurrentPoint = useCallback(
    (mouseX: number, mouseY: number): boolean => {
      if (!scalesRef.current) return false;
      const { xScale, yScale } = scalesRef.current;

      const pointX = xScale(displayPoint.x);
      const pointY = yScale(displayPoint.y);
      const distance = Math.sqrt(Math.pow(mouseX - pointX, 2) + Math.pow(mouseY - pointY, 2));
      // Larger touch target for mobile (minimum 44px)
      return distance < 22;
    },
    [displayPoint]
  );

  // Keyboard navigation handler
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if container or its children are focused
      if (!container.contains(document.activeElement) && document.activeElement !== container) {
        return;
      }

      let delta = 0;
      switch (e.key) {
        case 'ArrowLeft':
          delta = e.shiftKey ? -5 : -1;
          break;
        case 'ArrowRight':
          delta = e.shiftKey ? 5 : 1;
          break;
        case 'Home':
          // Reset zoom
          handleResetZoom();
          return;
        default:
          return;
      }

      if (delta !== 0 && onWavelengthShift) {
        e.preventDefault();
        onWavelengthShift(delta);
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [onWavelengthShift, handleResetZoom]);

  // Mouse and Touch event handlers with requestAnimationFrame
  useEffect(() => {
    const svgElement = svgRef.current;
    if (!svgElement || !scalesRef.current) return;

    let accumulatedDelta = 0;

    // Helper to get position from mouse or touch event
    const getEventPosition = (e: MouseEvent | Touch, rect: DOMRect) => {
      return {
        rawX: e.clientX - rect.left,
        rawY: e.clientY - rect.top,
      };
    };

    // Helper to check if position is on draggable area
    // Semantic Zoom: No transform adjustment needed, scalesRef.current already reflects zoom
    const checkDraggableArea = (rawX: number, rawY: number) => {
      // In Semantic Zoom, mouse coordinates are used directly
      // since scales already reflect the current zoom level
      const mouseX = rawX;
      const mouseY = rawY;

      const onRidge = spectrumRidgeData && spectrumRidgeData.length > 0 && isInsideRidge(mouseX, mouseY);
      const onPoint = isNearCurrentPoint(mouseX, mouseY);

      return { onRidge, onPoint, mouseX, mouseY };
    };

    // Start drag (mouse or touch)
    const startDrag = (rawX: number, rawY: number, e?: Event) => {
      const { onRidge, onPoint } = checkDraggableArea(rawX, rawY);

      if (onRidge || onPoint) {
        if (e) {
          e.stopPropagation();
          e.preventDefault();
        }

        isDragging.current = true;
        lastDragPos.current = { x: rawX, y: rawY };
        accumulatedDelta = 0;
        svgElement.style.cursor = 'ew-resize';
        setDragDelta(0);
        return true;
      }
      return false;
    };

    // Move during drag
    const moveDrag = (rawX: number, rawY: number) => {
      // Update hover state (mouse only)
      if (!isDragging.current) {
        const { onRidge, onPoint } = checkDraggableArea(rawX, rawY);
        setIsHoveringRidge(onRidge || onPoint);
        svgElement.style.cursor = onRidge || onPoint ? 'ew-resize' : 'default';
      }

      // Handle dragging with requestAnimationFrame for 60fps
      if (isDragging.current && lastDragPos.current && onShiftChange && scalesRef.current) {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }

        animationFrameRef.current = requestAnimationFrame(() => {
          if (!lastDragPos.current || !scalesRef.current) return;

          // Semantic Zoom: Use current scales directly (already zoom-adjusted)
          const { xScale } = scalesRef.current;
          const coordDeltaX = xScale.invert(rawX) - xScale.invert(lastDragPos.current.x);

          const nmDelta = coordDeltaX * 200;
          accumulatedDelta += nmDelta;

          onShiftChange(coordDeltaX, 0);
          setDragDelta(accumulatedDelta);

          lastDragPos.current = { x: rawX, y: rawY };
        });
      }
    };

    // End drag
    const endDrag = () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      isDragging.current = false;
      lastDragPos.current = null;
      svgElement.style.cursor = 'default';

      setTimeout(() => setDragDelta(null), 500);
    };

    // Mouse event handlers
    const handleMouseDown = (e: MouseEvent) => {
      const rect = svgElement.getBoundingClientRect();
      const { rawX, rawY } = getEventPosition(e, rect);
      startDrag(rawX, rawY, e);
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = svgElement.getBoundingClientRect();
      const { rawX, rawY } = getEventPosition(e, rect);
      moveDrag(rawX, rawY);
    };

    const handleMouseUp = () => {
      endDrag();
    };

    // Touch event handlers
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return; // Single touch only for drag

      const rect = svgElement.getBoundingClientRect();
      const { rawX, rawY } = getEventPosition(e.touches[0], rect);

      if (startDrag(rawX, rawY, e)) {
        setIsHoveringRidge(true);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1 || !isDragging.current) return;

      const rect = svgElement.getBoundingClientRect();
      const { rawX, rawY } = getEventPosition(e.touches[0], rect);

      // Prevent scrolling when dragging on the ridge
      if (isDragging.current) {
        e.preventDefault();
      }

      moveDrag(rawX, rawY);
    };

    const handleTouchEnd = () => {
      setIsHoveringRidge(false);
      endDrag();
    };

    // Add event listeners
    svgElement.addEventListener('mousedown', handleMouseDown);
    svgElement.addEventListener('mousemove', handleMouseMove);
    svgElement.addEventListener('mouseup', handleMouseUp);
    svgElement.addEventListener('mouseleave', handleMouseUp);

    // Touch events with passive: false to allow preventDefault
    svgElement.addEventListener('touchstart', handleTouchStart, { passive: false });
    svgElement.addEventListener('touchmove', handleTouchMove, { passive: false });
    svgElement.addEventListener('touchend', handleTouchEnd);
    svgElement.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      svgElement.removeEventListener('mousedown', handleMouseDown);
      svgElement.removeEventListener('mousemove', handleMouseMove);
      svgElement.removeEventListener('mouseup', handleMouseUp);
      svgElement.removeEventListener('mouseleave', handleMouseUp);
      svgElement.removeEventListener('touchstart', handleTouchStart);
      svgElement.removeEventListener('touchmove', handleTouchMove);
      svgElement.removeEventListener('touchend', handleTouchEnd);
      svgElement.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [spectrumRidgeData, isInsideRidge, isNearCurrentPoint, onShiftChange, shiftNm]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full"
      tabIndex={0}
      style={{ minHeight: '400px', outline: 'none' }}
    >
      {/* Loading Indicator */}
      {isLoading && (
        <div className={`absolute inset-0 flex items-center justify-center z-20 ${themeColors.loadingBg}`}>
          <div className="flex flex-col items-center gap-3">
            <div className={`w-10 h-10 border-4 ${themeColors.spinnerBorder} border-t-blue-500 rounded-full animate-spin`} />
            <span className={`text-sm ${themeColors.spinnerText}`}>Loading diagram...</span>
          </div>
        </div>
      )}

      {/* Zoom Controls */}
      <div className="absolute top-2 right-2 flex flex-col gap-1 z-10">
        <button
          onClick={handleResetZoom}
          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors border ${themeColors.controlBg} ${themeColors.controlText} ${themeColors.controlBorder}`}
          title="Reset zoom (Home)"
          aria-label="Reset zoom"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
        </button>
        <div className={`text-[10px] text-center rounded px-1 py-0.5 border ${themeColors.controlBg} ${themeColors.controlBorder} ${themeColors.hintText}`}>
          {Math.round(zoomLevel * 100)}%
        </div>
      </div>

      {/* Keyboard Hint */}
      <div className={`absolute bottom-2 left-2 text-[10px] z-10 ${themeColors.hintText}`}>
        <kbd className={`px-1 py-0.5 rounded border ${themeColors.kbdBg} ${themeColors.kbdText} ${themeColors.kbdBorder}`}>←</kbd>
        <kbd className={`px-1 py-0.5 rounded border ml-0.5 ${themeColors.kbdBg} ${themeColors.kbdText} ${themeColors.kbdBorder}`}>→</kbd>
        <span className="ml-1">±1nm</span>
        <span className="mx-1">|</span>
        <kbd className={`px-1 py-0.5 rounded border ${themeColors.kbdBg} ${themeColors.kbdText} ${themeColors.kbdBorder}`}>Shift</kbd>
        <span className="ml-1">±5nm</span>
        <span className="mx-1">|</span>
        <span>Double-click axis to set range</span>
      </div>

      <svg
        ref={svgRef}
        className="w-full h-full"
        style={{ minHeight: '400px' }}
      />

      {/* Axis Range Modal */}
      {axisRangeModal && (
        <AxisRangeModal
          isOpen={axisRangeModal.isOpen}
          axis={axisRangeModal.axis}
          currentMin={axisRangeModal.min}
          currentMax={axisRangeModal.max}
          onApply={(min, max) => handleAxisRangeApply(axisRangeModal.axis, min, max)}
          onClose={() => setAxisRangeModal(null)}
          theme={theme}
        />
      )}
    </div>
  );
}

// Helper function for gamut colors
function getGamutColor(gamut: GamutType): string {
  switch (gamut) {
    case 'sRGB':
      return '#ef4444';
    case 'DCI-P3':
      return '#22c55e';
    case 'BT.2020':
      return '#3b82f6';
    case 'AdobeRGB':
      return '#f59e0b';
    default:
      return '#888888';
  }
}

export default CIEDiagram;
