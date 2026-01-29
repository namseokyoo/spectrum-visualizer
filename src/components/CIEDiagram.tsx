/**
 * CIE Chromaticity Diagram Component
 *
 * D3.js-based interactive visualization of CIE color spaces
 * Supports both CIE 1931 xy and CIE 1976 u'v' representations
 */

import { useEffect, useRef, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import { SPECTRAL_LOCUS_XY, COLOR_GAMUTS } from '../data/cie1931';
import { xyToUV } from '../lib/chromaticity';
import type {
  CIE1931Coordinates,
  CIE1976Coordinates,
  DiagramMode,
  GamutType,
  Snapshot,
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
}

export function CIEDiagram({
  currentPoint,
  currentPointUV,
  mode,
  enabledGamuts,
  snapshots = [],
  onShiftChange,
  hexColor = '#ffffff',
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

  // Handle drag interactions
  const handleDrag = useCallback(
    (event: MouseEvent, svg: SVGSVGElement, xScale: d3.ScaleLinear<number, number>, yScale: d3.ScaleLinear<number, number>) => {
      if (!isDragging.current || !onShiftChange) return;

      const rect = svg.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      const currentX = xScale.invert(x);
      const currentY = yScale.invert(y);

      if (lastDragPos.current) {
        const deltaX = currentX - lastDragPos.current.x;
        const deltaY = currentY - lastDragPos.current.y;
        onShiftChange(deltaX, deltaY);
      }

      lastDragPos.current = { x: currentX, y: currentY };
    },
    [onShiftChange]
  );

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
    const locusPath = d3
      .line<{ x: number; y: number }>()
      .x((d) => xScale(d.x))
      .y((d) => yScale(d.y))
      .curve(d3.curveCardinal.tension(0.8));

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
      .attr('stroke-width', 3)
      .attr('stroke-linecap', 'round');

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

    // Drag handlers
    const svgElement = svgRef.current;

    const handleMouseDown = (e: MouseEvent) => {
      // Check if click is near current point
      const rect = svgElement.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const pointX = xScale(displayPoint.x);
      const pointY = yScale(displayPoint.y);
      const distance = Math.sqrt(
        Math.pow(mouseX - pointX, 2) + Math.pow(mouseY - pointY, 2)
      );

      if (distance < 20) {
        isDragging.current = true;
        lastDragPos.current = { x: xScale.invert(mouseX), y: yScale.invert(mouseY) };
        svgElement.style.cursor = 'grabbing';
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      handleDrag(e, svgElement, xScale, yScale);
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
    displayPoint,
    snapshotPoints,
    gamutData,
    hexColor,
    mode,
    handleDrag,
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
    default:
      return '#888888';
  }
}

export default CIEDiagram;
