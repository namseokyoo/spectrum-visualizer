/**
 * CIE Chromaticity Diagram Component
 *
 * D3.js-based interactive visualization of CIE color spaces
 * Supports both CIE 1931 xy and CIE 1976 u'v' representations
 * Features Spectrum-on-Locus visualization with draggable spectrum ridge
 */

import { useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import { SPECTRAL_LOCUS_XY, COLOR_GAMUTS } from '../data/cie1931';
import { xyToUV } from '../lib/chromaticity';
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
}: CIEDiagramProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const isDragging = useRef(false);
  const lastDragPos = useRef<{ x: number; y: number } | null>(null);

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

  // Calculate spectrum ridge data (Spectrum-on-Locus)
  // Each point on the locus gets extruded along its normal based on spectrum intensity
  const spectrumRidgeData = useMemo(() => {
    if (!spectrum || spectrum.length === 0) return null;

    // Filter locus points to visible spectrum range (380-700nm for meaningful display)
    const visibleLocus = spectralLocusData.filter(
      (p) => p.wavelength >= 380 && p.wavelength <= 700
    );

    // Scale factor for ridge height (coordinate units)
    const ridgeScale = mode === 'CIE1931' ? 0.08 : 0.06;

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
  }, [spectralLocusData, spectrum, shiftNm, mode]);

  // Current point in diagram coordinates
  const displayPoint = useMemo(() => {
    if (mode === 'CIE1976' && currentPointUV) {
      return { x: currentPointUV.u, y: currentPointUV.v };
    }
    return convertToMode(currentPoint, mode);
  }, [currentPoint, currentPointUV, mode]);

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

  // D3 rendering
  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;
    const margin = { top: 30, right: 30, bottom: 50, left: 50 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Clear previous content
    svg.selectAll('*').remove();

    // Create scales
    const xScale = d3
      .scaleLinear()
      .domain([bounds.xMin, bounds.xMax])
      .range([margin.left, margin.left + innerWidth]);

    const yScale = d3
      .scaleLinear()
      .domain([bounds.yMin, bounds.yMax])
      .range([margin.top + innerHeight, margin.top]);

    // Background
    svg
      .append('rect')
      .attr('width', width)
      .attr('height', height)
      .attr('fill', '#1a1a2e');

    // Create defs for gradient
    const defs = svg.append('defs');

    // Create gradient for spectral locus
    const gradient = defs
      .append('linearGradient')
      .attr('id', 'spectral-gradient')
      .attr('gradientUnits', 'userSpaceOnUse');

    // Add gradient stops based on wavelength
    SPECTRAL_LOCUS_XY.forEach((point, i) => {
      gradient
        .append('stop')
        .attr('offset', `${(i / (SPECTRAL_LOCUS_XY.length - 1)) * 100}%`)
        .attr('stop-color', wavelengthToRGB(point.wavelength));
    });

    // Create main group
    const g = svg.append('g');

    // Draw filled horseshoe shape with gradient background
    // Use curveCatmullRom for smoother curves (more natural interpolation)
    const locusPath = d3
      .line<{ x: number; y: number }>()
      .x((d) => xScale(d.x))
      .y((d) => yScale(d.y))
      .curve(d3.curveCatmullRom.alpha(0.5));

    // Close the path for filled horseshoe
    const closedLocusData = [
      ...spectralLocusData,
      spectralLocusData[0], // Close back to start
    ];

    // Create filled area with semi-transparent gradient
    g.append('path')
      .datum(closedLocusData)
      .attr('d', locusPath)
      .attr('fill', 'url(#spectral-gradient)')
      .attr('fill-opacity', 0.15)
      .attr('stroke', 'none');

    // Draw spectral locus outline
    g.append('path')
      .datum(spectralLocusData)
      .attr('d', locusPath)
      .attr('fill', 'none')
      .attr('stroke', 'url(#spectral-gradient)')
      .attr('stroke-width', 2)
      .attr('stroke-linecap', 'round');

    // Draw Spectrum-on-Locus Ridge (mountain-like visualization)
    if (spectrumRidgeData && spectrumRidgeData.length > 0) {
      // Create the ridge area path
      // Base line is the spectral locus, top line is the extruded ridge
      const ridgeAreaData: { x: number; y: number }[] = [];

      // Add top points (extruded)
      spectrumRidgeData.forEach((p) => {
        ridgeAreaData.push({ x: p.x, y: p.y });
      });

      // Add base points in reverse order to close the shape
      for (let i = spectrumRidgeData.length - 1; i >= 0; i--) {
        ridgeAreaData.push({
          x: spectrumRidgeData[i].baseX,
          y: spectrumRidgeData[i].baseY,
        });
      }

      // Create smooth area path
      const ridgePath = d3
        .line<{ x: number; y: number }>()
        .x((d) => xScale(d.x))
        .y((d) => yScale(d.y))
        .curve(d3.curveCatmullRom.alpha(0.5));

      // Ridge fill gradient
      const ridgeGradient = defs
        .append('linearGradient')
        .attr('id', 'ridge-gradient')
        .attr('gradientUnits', 'userSpaceOnUse')
        .attr('x1', xScale(spectrumRidgeData[0].baseX))
        .attr('y1', yScale(spectrumRidgeData[0].baseY))
        .attr('x2', xScale(spectrumRidgeData[spectrumRidgeData.length - 1].baseX))
        .attr('y2', yScale(spectrumRidgeData[spectrumRidgeData.length - 1].baseY));

      // Add gradient stops based on wavelength colors
      spectrumRidgeData.forEach((p, i) => {
        if (p.intensity > 0.01) {
          ridgeGradient
            .append('stop')
            .attr('offset', `${(i / (spectrumRidgeData.length - 1)) * 100}%`)
            .attr('stop-color', wavelengthToRGB(p.wavelength))
            .attr('stop-opacity', 0.3 + p.intensity * 0.5);
        }
      });

      // Draw filled ridge area
      const ridgeGroup = g.append('g').attr('class', 'spectrum-ridge');

      ridgeGroup
        .append('path')
        .datum(ridgeAreaData)
        .attr('d', ridgePath)
        .attr('fill', 'url(#ridge-gradient)')
        .attr('fill-opacity', 0.6)
        .attr('stroke', 'none')
        .attr('class', 'ridge-fill')
        .style('cursor', 'ew-resize');

      // Draw ridge outline (top edge only)
      const ridgeOutlinePath = d3
        .line<{ x: number; y: number }>()
        .x((d) => xScale(d.x))
        .y((d) => yScale(d.y))
        .curve(d3.curveCatmullRom.alpha(0.5));

      const ridgeTopPoints = spectrumRidgeData.map((p) => ({ x: p.x, y: p.y }));

      ridgeGroup
        .append('path')
        .datum(ridgeTopPoints)
        .attr('d', ridgeOutlinePath)
        .attr('fill', 'none')
        .attr('stroke', hexColor)
        .attr('stroke-width', 2)
        .attr('stroke-opacity', 0.8)
        .attr('class', 'ridge-outline')
        .style('cursor', 'ew-resize');

      // Add glow effect to the ridge peak area
      const peakPoint = spectrumRidgeData.reduce((max, p) =>
        p.intensity > max.intensity ? p : max
      );

      if (peakPoint.intensity > 0.1) {
        ridgeGroup
          .append('circle')
          .attr('cx', xScale(peakPoint.x))
          .attr('cy', yScale(peakPoint.y))
          .attr('r', 12)
          .attr('fill', hexColor)
          .attr('opacity', 0.3)
          .attr('filter', 'url(#glow-filter)')
          .style('pointer-events', 'none');
      }

      // Add glow filter
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
    }

    // Draw purple line (closing the horseshoe)
    const purpleLine = [
      spectralLocusData[0],
      spectralLocusData[spectralLocusData.length - 1],
    ];
    g.append('line')
      .attr('x1', xScale(purpleLine[0].x))
      .attr('y1', yScale(purpleLine[0].y))
      .attr('x2', xScale(purpleLine[1].x))
      .attr('y2', yScale(purpleLine[1].y))
      .attr('stroke', '#8b5cf6')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '6,4');

    // Add wavelength labels
    const labelWavelengths = [380, 420, 460, 480, 500, 520, 540, 560, 580, 600, 620, 650, 700];
    const labelsGroup = g.append('g').attr('class', 'wavelength-labels');

    spectralLocusData
      .filter((d) => labelWavelengths.includes(d.wavelength))
      .forEach((d) => {
        // Calculate label position offset (outward from locus)
        const idx = spectralLocusData.findIndex((p) => p.wavelength === d.wavelength);
        const prev = spectralLocusData[Math.max(0, idx - 1)];
        const next = spectralLocusData[Math.min(spectralLocusData.length - 1, idx + 1)];

        // Direction perpendicular to curve
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

    // Draw gamut triangles
    gamutData.forEach((gamut) => {
      const trianglePath = d3
        .line<{ x: number; y: number }>()
        .x((d) => xScale(d.x))
        .y((d) => yScale(d.y));

      const closedVertices = [...gamut.vertices, gamut.vertices[0]];

      g.append('path')
        .datum(closedVertices)
        .attr('d', trianglePath)
        .attr('fill', gamut.color)
        .attr('fill-opacity', 0.1)
        .attr('stroke', gamut.color)
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '8,4');

      // Add gamut label
      const centroid = {
        x: gamut.vertices.reduce((sum, v) => sum + v.x, 0) / 3,
        y: gamut.vertices.reduce((sum, v) => sum + v.y, 0) / 3,
      };

      g.append('text')
        .attr('x', xScale(centroid.x))
        .attr('y', yScale(centroid.y))
        .attr('fill', gamut.color)
        .attr('font-size', '11px')
        .attr('text-anchor', 'middle')
        .attr('font-weight', 'bold')
        .attr('opacity', 0.8)
        .text(gamut.name);
    });

    // Draw D65 white point
    const d65 =
      mode === 'CIE1976'
        ? { x: 0.1978, y: 0.4683 }
        : { x: 0.3127, y: 0.329 };

    g.append('circle')
      .attr('cx', xScale(d65.x))
      .attr('cy', yScale(d65.y))
      .attr('r', 4)
      .attr('fill', 'white')
      .attr('stroke', '#333')
      .attr('stroke-width', 1);

    g.append('text')
      .attr('x', xScale(d65.x) + 8)
      .attr('y', yScale(d65.y) + 4)
      .attr('fill', '#ccc')
      .attr('font-size', '10px')
      .text('D65');

    // Draw snapshot points
    snapshotPoints.forEach((snapshot, idx) => {
      g.append('circle')
        .attr('cx', xScale(snapshot.point.x))
        .attr('cy', yScale(snapshot.point.y))
        .attr('r', 6)
        .attr('fill', snapshot.color)
        .attr('stroke', '#fff')
        .attr('stroke-width', 1.5)
        .attr('opacity', 0.7);

      // Index label
      g.append('text')
        .attr('x', xScale(snapshot.point.x) + 10)
        .attr('y', yScale(snapshot.point.y) + 4)
        .attr('fill', '#888')
        .attr('font-size', '9px')
        .text(snapshot.label || `#${idx + 1}`);
    });

    // Draw current point (larger, with glow effect)
    const currentPointGroup = g.append('g').attr('class', 'current-point');

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

    // Add axes
    const xAxis = d3.axisBottom(xScale).ticks(8).tickSize(-innerHeight);
    const yAxis = d3.axisLeft(yScale).ticks(8).tickSize(-innerWidth);

    svg
      .append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${margin.top + innerHeight})`)
      .call(xAxis)
      .call((g) => g.select('.domain').remove())
      .call((g) =>
        g.selectAll('.tick line').attr('stroke', '#333').attr('stroke-dasharray', '2,2')
      )
      .call((g) => g.selectAll('.tick text').attr('fill', '#888').attr('font-size', '10px'));

    svg
      .append('g')
      .attr('class', 'y-axis')
      .attr('transform', `translate(${margin.left},0)`)
      .call(yAxis)
      .call((g) => g.select('.domain').remove())
      .call((g) =>
        g.selectAll('.tick line').attr('stroke', '#333').attr('stroke-dasharray', '2,2')
      )
      .call((g) => g.selectAll('.tick text').attr('fill', '#888').attr('font-size', '10px'));

    // Axis labels
    svg
      .append('text')
      .attr('x', margin.left + innerWidth / 2)
      .attr('y', height - 10)
      .attr('fill', '#aaa')
      .attr('font-size', '12px')
      .attr('text-anchor', 'middle')
      .text(mode === 'CIE1931' ? 'x' : "u'");

    svg
      .append('text')
      .attr('x', 15)
      .attr('y', margin.top + innerHeight / 2)
      .attr('fill', '#aaa')
      .attr('font-size', '12px')
      .attr('text-anchor', 'middle')
      .attr('transform', `rotate(-90, 15, ${margin.top + innerHeight / 2})`)
      .text(mode === 'CIE1931' ? 'y' : "v'");

    // Mode indicator
    svg
      .append('text')
      .attr('x', width - margin.right)
      .attr('y', margin.top)
      .attr('fill', '#666')
      .attr('font-size', '11px')
      .attr('text-anchor', 'end')
      .text(mode === 'CIE1931' ? 'CIE 1931 xy' : "CIE 1976 u'v'");

    // Drag handlers for spectrum ridge
    const svgElement = svgRef.current;

    // Check if a point is inside the spectrum ridge area
    const isInsideRidge = (mouseX: number, mouseY: number): boolean => {
      if (!spectrumRidgeData || spectrumRidgeData.length === 0) return false;

      // Check if mouse is within the ridge bounding box (with some tolerance)
      const ridgeMinX = Math.min(...spectrumRidgeData.map((p) => Math.min(xScale(p.x), xScale(p.baseX)))) - 10;
      const ridgeMaxX = Math.max(...spectrumRidgeData.map((p) => Math.max(xScale(p.x), xScale(p.baseX)))) + 10;
      const ridgeMinY = Math.min(...spectrumRidgeData.map((p) => Math.min(yScale(p.y), yScale(p.baseY)))) - 10;
      const ridgeMaxY = Math.max(...spectrumRidgeData.map((p) => Math.max(yScale(p.y), yScale(p.baseY)))) + 10;

      if (mouseX < ridgeMinX || mouseX > ridgeMaxX || mouseY < ridgeMinY || mouseY > ridgeMaxY) {
        return false;
      }

      // More precise check: find if mouse is near any ridge segment
      for (let i = 0; i < spectrumRidgeData.length; i++) {
        const p = spectrumRidgeData[i];
        const px = xScale(p.x);
        const py = yScale(p.y);
        const bx = xScale(p.baseX);
        const by = yScale(p.baseY);

        // Check distance to the ridge line segment
        const distToTop = Math.sqrt(Math.pow(mouseX - px, 2) + Math.pow(mouseY - py, 2));
        const distToBase = Math.sqrt(Math.pow(mouseX - bx, 2) + Math.pow(mouseY - by, 2));

        if (distToTop < 20 || distToBase < 20) {
          return true;
        }

        // Check if point is between base and top
        if (p.intensity > 0.05) {
          const midX = (px + bx) / 2;
          const midY = (py + by) / 2;
          const distToMid = Math.sqrt(Math.pow(mouseX - midX, 2) + Math.pow(mouseY - midY, 2));
          if (distToMid < 25) {
            return true;
          }
        }
      }

      return false;
    };

    // Also check if near current point (fallback for when no spectrum)
    const isNearCurrentPoint = (mouseX: number, mouseY: number): boolean => {
      const pointX = xScale(displayPoint.x);
      const pointY = yScale(displayPoint.y);
      const distance = Math.sqrt(
        Math.pow(mouseX - pointX, 2) + Math.pow(mouseY - pointY, 2)
      );
      return distance < 20;
    };

    const handleMouseDown = (e: MouseEvent) => {
      const rect = svgElement.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Check if click is on spectrum ridge or current point
      const onRidge = spectrumRidgeData && spectrumRidgeData.length > 0 && isInsideRidge(mouseX, mouseY);
      const onPoint = isNearCurrentPoint(mouseX, mouseY);

      if (onRidge || onPoint) {
        isDragging.current = true;
        lastDragPos.current = { x: mouseX, y: mouseY };
        svgElement.style.cursor = 'ew-resize';
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = svgElement.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Update cursor based on hover state
      if (!isDragging.current) {
        const onRidge = spectrumRidgeData && spectrumRidgeData.length > 0 && isInsideRidge(mouseX, mouseY);
        const onPoint = isNearCurrentPoint(mouseX, mouseY);
        if (onRidge || onPoint) {
          svgElement.style.cursor = 'ew-resize';
        } else {
          svgElement.style.cursor = 'default';
        }
      }

      // Handle dragging
      if (isDragging.current && lastDragPos.current && onShiftChange) {
        // Calculate horizontal delta in pixels
        // Use coordinate-based shift change for wavelength shift
        const coordDeltaX = xScale.invert(mouseX) - xScale.invert(lastDragPos.current.x);
        onShiftChange(coordDeltaX, 0);

        lastDragPos.current = { x: mouseX, y: mouseY };
      }
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      lastDragPos.current = null;
      svgElement.style.cursor = 'default';
    };

    svgElement.addEventListener('mousedown', handleMouseDown);
    svgElement.addEventListener('mousemove', handleMouseMove);
    svgElement.addEventListener('mouseup', handleMouseUp);
    svgElement.addEventListener('mouseleave', handleMouseUp);

    return () => {
      svgElement.removeEventListener('mousedown', handleMouseDown);
      svgElement.removeEventListener('mousemove', handleMouseMove);
      svgElement.removeEventListener('mouseup', handleMouseUp);
      svgElement.removeEventListener('mouseleave', handleMouseUp);
    };
  }, [
    bounds,
    spectralLocusData,
    spectrumRidgeData,
    displayPoint,
    snapshotPoints,
    gamutData,
    hexColor,
    mode,
    shiftNm,
    onShiftChange,
  ]);

  return (
    <svg
      ref={svgRef}
      className="w-full h-full"
      style={{ minHeight: '400px' }}
    />
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
