import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import * as Sentry from '@sentry/react';
import { DataInput } from './components/DataInput';
import { CIEDiagram } from './components/CIEDiagram';
import { SnapshotList } from './components/SnapshotList';
import { MobileControlPanel } from './components/mobile/MobileControlPanel';
import { ExportModal } from './components/ExportModal';
import type { ExportFormat } from './components/ExportModal';
import { useSnapshots } from './hooks/useSnapshots';
import { useTheme } from './hooks/useTheme';
import { calculateChromaticity, shiftSpectrum, PRESET_GREEN, analyzeSpectrum } from './lib';
import { exportCSV, exportSVG, exportPNG, exportJSON, generateFilename, downloadFile, downloadDataUrl } from './lib/export';
import type { SpectrumPoint, ChromaticityResult, DiagramMode, GamutType } from './types/spectrum';

// Session storage key and interface
const SESSION_STORAGE_KEY = 'spectrum-visualizer-session';

interface AxisRange {
  min: number;
  max: number;
}

interface CustomAxisRanges {
  x?: AxisRange;
  y?: AxisRange;
}

interface SessionState {
  spectrum: SpectrumPoint[];
  shiftNm: number;
  diagramMode: DiagramMode;
  enabledGamuts: GamutType[];
  intensityScale: number;
  zoomTransform: { k: number; x: number; y: number } | null;
  customAxisRanges?: CustomAxisRanges;
}

// Load session from localStorage
const loadSession = (): Partial<SessionState> => {
  try {
    const saved = localStorage.getItem(SESSION_STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
};

function App() {
  const { theme, toggleTheme } = useTheme();
  // Note: Responsive layout uses lg: breakpoint (1024px) for 3-column layout
  // This ensures proper behavior when mobile users select "Request Desktop Site" (viewport ~980px)
  // - Below lg: Mobile/tablet layout with FAB controls
  // - lg+: Full 3-column desktop layout with sidebars

  // Load saved session state
  const savedSession = useMemo(() => loadSession(), []);

  const [spectrum, setSpectrum] = useState<SpectrumPoint[]>(
    savedSession.spectrum || PRESET_GREEN
  );
  const [shiftNm, setShiftNm] = useState(savedSession.shiftNm ?? 0);
  const [diagramMode, setDiagramMode] = useState<DiagramMode>(
    savedSession.diagramMode || 'CIE1931'
  );
  const [enabledGamuts, setEnabledGamuts] = useState<GamutType[]>(
    savedSession.enabledGamuts || ['sRGB']
  );
  const [intensityScale, setIntensityScale] = useState(
    savedSession.intensityScale ?? 1.0
  );
  const [zoomTransform, setZoomTransform] = useState<{ k: number; x: number; y: number } | null>(
    savedSession.zoomTransform || null
  );
  const [customAxisRanges, setCustomAxisRanges] = useState<CustomAxisRanges>(
    savedSession.customAxisRanges || {}
  );

  // Monitor section tab state
  const [monitorTab, setMonitorTab] = useState<'color' | 'spectrum'>('color');

  // Export modal state
  const [showExportModal, setShowExportModal] = useState(false);
  const svgExportElRef = useRef<SVGSVGElement | null>(null);

  // Snapshot management
  const {
    snapshots,
    addSnapshot,
    removeSnapshot,
    clearSnapshots,
    canAddMore,
  } = useSnapshots();

  // Calculate chromaticity with shift applied
  const chromaticity = useMemo<ChromaticityResult>(() => {
    const shiftedSpectrum = shiftSpectrum(spectrum, shiftNm);
    return calculateChromaticity(shiftedSpectrum);
  }, [spectrum, shiftNm]);

  // Calculate spectrum analysis (peak, FWHM, FWQM)
  const spectrumAnalysis = useMemo(() => {
    return analyzeSpectrum(spectrum, shiftNm);
  }, [spectrum, shiftNm]);

  // Handle data loaded from DataInput
  const handleDataLoaded = useCallback((data: SpectrumPoint[]) => {
    setSpectrum(data);
    setShiftNm(0); // Reset shift when new data is loaded
  }, []);

  // Handle shift change
  const handleShiftChange = useCallback((value: number) => {
    // Clamp to range and round to 0.1nm
    const clamped = Math.max(-100, Math.min(100, value));
    setShiftNm(Math.round(clamped * 10) / 10);
  }, []);

  // Handle drag on diagram (converts coordinate delta to wavelength shift)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleDiagramDrag = useCallback((deltaX: number, _deltaY: number) => {
    // Use deltaX as primary (horizontal movement → wavelength shift)
    // Scale factor: 0.01 coordinate units ≈ 1nm shift
    // _deltaY reserved for future vertical interactions
    const sensitivity = 200; // Adjust for feel
    const nmDelta = deltaX * sensitivity;
    handleShiftChange(shiftNm + nmDelta);
  }, [shiftNm, handleShiftChange]);

  // Handle keyboard wavelength shift (direct nm delta)
  const handleWavelengthShift = useCallback((delta: number) => {
    handleShiftChange(shiftNm + delta);
  }, [shiftNm, handleShiftChange]);

  // Toggle gamut visibility
  const toggleGamut = useCallback((gamut: GamutType) => {
    setEnabledGamuts((prev) =>
      prev.includes(gamut)
        ? prev.filter((g) => g !== gamut)
        : [...prev, gamut]
    );
  }, []);

  // Save snapshot
  const handleSaveSnapshot = useCallback(() => {
    addSnapshot(shiftNm, chromaticity);
  }, [shiftNm, chromaticity, addSnapshot]);

  // Save session state to localStorage
  useEffect(() => {
    const session: SessionState = {
      spectrum,
      shiftNm,
      diagramMode,
      enabledGamuts,
      intensityScale,
      zoomTransform,
      customAxisRanges,
    };
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  }, [spectrum, shiftNm, diagramMode, enabledGamuts, intensityScale, zoomTransform, customAxisRanges]);

  // Reset all settings
  const handleResetAll = useCallback(() => {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    setSpectrum(PRESET_GREEN);
    setShiftNm(0);
    setDiagramMode('CIE1931');
    setEnabledGamuts(['sRGB']);
    setIntensityScale(1.0);
    setZoomTransform(null);
    setCustomAxisRanges({});
  }, []);

  // Handle zoom change from CIEDiagram
  const handleZoomChange = useCallback((transform: { k: number; x: number; y: number }) => {
    setZoomTransform(transform);
  }, []);

  // Handle export (async for PNG support)
  const handleExport = useCallback(async (format: ExportFormat, includeSnapshots: boolean) => {
    const exportData = {
      spectrum,
      chromaticity,
      analysis: spectrumAnalysis,
      diagramMode,
      shiftNm,
      snapshots,
    };

    if (format === 'csv') {
      const csvContent = exportCSV(exportData, { includeSnapshots });
      downloadFile(csvContent, generateFilename('csv'), 'text/csv;charset=utf-8');
    } else if (format === 'svg') {
      if (!svgExportElRef.current) {
        return;
      }
      const svgContent = exportSVG(svgExportElRef.current, { includeInlineStyles: true });
      downloadFile(svgContent, generateFilename('svg'), 'image/svg+xml;charset=utf-8');
    } else if (format === 'png') {
      if (!svgExportElRef.current) {
        return;
      }
      // Capture the SVG's parent container for a cleaner raster output
      const targetElement = svgExportElRef.current.closest('.cie-diagram-container') as HTMLElement
        ?? svgExportElRef.current.parentElement;
      if (!targetElement) {
        return;
      }
      try {
        const backgroundColor = theme === 'dark' ? '#1f2937' : '#ffffff';
        const dataUrl = await exportPNG(targetElement, {
          pixelRatio: 2,
          backgroundColor,
        });
        downloadDataUrl(dataUrl, generateFilename('png'));
      } catch (err) {
        Sentry.captureException(err, { tags: { context: 'png-export' } });
      }
    } else if (format === 'json') {
      const jsonContent = exportJSON(
        {
          ...exportData,
          enabledGamuts,
          intensityScale,
        },
        { includeSnapshots }
      );
      downloadFile(jsonContent, generateFilename('json'), 'application/json;charset=utf-8');
    }
  }, [spectrum, chromaticity, spectrumAnalysis, diagramMode, shiftNm, snapshots, enabledGamuts, intensityScale, theme]);

  // SVG ref callback for export
  const handleSvgExportRef = useCallback((el: SVGSVGElement | null) => {
    svgExportElRef.current = el;
  }, []);

  // Restore snapshot
  const handleRestoreSnapshot = useCallback((snapshot: { shiftNm: number }) => {
    setShiftNm(snapshot.shiftNm);
  }, []);

  return (
    <div className={`min-h-screen w-full ${theme === 'dark' ? 'bg-gray-900 text-gray-100' : 'bg-white text-gray-900'}`}>
      {/* Header */}
      <header className={`backdrop-blur-sm px-4 lg:px-6 py-2 lg:py-3 sticky top-0 z-10 ${theme === 'dark' ? 'bg-gray-800/80 border-b border-gray-700/50' : 'bg-gray-100/80 border-b border-gray-300/50'}`}>
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            {/* Mobile/Tablet title - hidden on lg and above */}
            <h1 className="lg:hidden text-base font-bold text-blue-400 tracking-tight truncate">
              ISCV
            </h1>
            {/* Desktop title - hidden below lg */}
            <h1 className="hidden lg:block text-xl font-bold text-blue-400 tracking-tight truncate">
              Interactive Spectrum-to-Color Visualizer
            </h1>
            {/* Mobile/Tablet subtitle */}
            <p className={`lg:hidden text-[10px] mt-0.5 truncate ${theme === 'dark' ? 'text-gray-500' : 'text-gray-600'}`}>
              Spectrum Analysis Tool
            </p>
            {/* Desktop subtitle */}
            <p className={`hidden lg:block text-xs mt-0.5 truncate ${theme === 'dark' ? 'text-gray-500' : 'text-gray-600'}`}>
              ISCV - Emission Spectrum Analysis Tool for OLED/Display Research
            </p>
          </div>
          <div className="flex items-center gap-2 lg:gap-4 flex-shrink-0">
            <button
              onClick={() => setShowExportModal(true)}
              className={`px-2 py-1 lg:px-3 lg:py-1.5 text-xs rounded-lg transition-colors flex items-center gap-1 ${theme === 'dark' ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}
              title="Export data"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span className="hidden lg:inline">Export</span>
            </button>
            <button
              onClick={handleResetAll}
              className={`px-2 py-1 lg:px-3 lg:py-1.5 text-xs rounded-lg transition-colors ${theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}
              title="Reset all settings"
            >
              Reset All
            </button>
            <button
              onClick={toggleTheme}
              className={`p-2 rounded-lg transition-colors touch-target ${theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-yellow-400' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                </svg>
              )}
            </button>
            {/* Version - hidden on mobile/tablet */}
            <div className={`hidden lg:block text-xs ${theme === 'dark' ? 'text-gray-600' : 'text-gray-500'}`}>
              v{__APP_VERSION__}
            </div>
          </div>
        </div>
      </header>

      {/* Main content area - flexible layout with overflow handling */}
      {/* Mobile: flex-1 to share space with inline control panel */}
      {/* Desktop: fixed height with sidebars */}
      <div className="flex flex-col lg:flex-row flex-1 lg:flex-none lg:h-[calc(100vh-56px)] overflow-hidden">
        {/* Left Sidebar - Hidden on mobile/tablet, shown on lg+ */}
        {/* Width: 220px on lg, 280px on xl+ for narrow viewport support */}
        <aside className={`hidden lg:block lg:w-[220px] xl:w-[280px] flex-shrink-0 p-3 xl:p-4 overflow-y-auto ${theme === 'dark' ? 'bg-gray-800/50 border-r border-gray-700/50' : 'bg-gray-50 border-r border-gray-200'}`}>
          {/* Data Input Section */}
          <section className="mb-5">
            <h2 className={`text-[11px] font-semibold mb-2 uppercase tracking-wider flex items-center gap-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
              Input
            </h2>
            <DataInput onDataLoaded={handleDataLoaded} />
          </section>

          {/* Wavelength Shift Control */}
          <section className="mb-5">
            <h2 className={`text-[11px] font-semibold mb-2 uppercase tracking-wider flex items-center gap-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
              Control
            </h2>
            <div className={`rounded-lg p-3 space-y-3 ${theme === 'dark' ? 'bg-gray-900/50 border border-gray-700/30' : 'bg-white border border-gray-200'}`}>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="-100"
                  max="100"
                  step="0.5"
                  value={shiftNm}
                  onChange={(e) => handleShiftChange(parseFloat(e.target.value))}
                  className="flex-1 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500 wavelength-slider"
                  style={{
                    background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((shiftNm + 100) / 200) * 100}%, #374151 ${((shiftNm + 100) / 200) * 100}%, #374151 100%)`
                  }}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-600'}`}>Shift:</span>
                  <input
                    type="number"
                    value={shiftNm}
                    onChange={(e) => handleShiftChange(parseFloat(e.target.value) || 0)}
                    step="0.5"
                    min="-100"
                    max="100"
                    className={`w-16 px-2 py-1 border rounded text-xs text-center focus:outline-none focus:border-blue-500 ${theme === 'dark' ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                  />
                  <span className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-600'}`}>nm</span>
                </div>
                <button
                  onClick={() => setShiftNm(0)}
                  className={`px-3 py-1 text-xs rounded transition-colors ${theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}
                >
                  Reset
                </button>
              </div>

              {/* Intensity Scale Control */}
              <div className={`pt-3 mt-3 border-t ${theme === 'dark' ? 'border-gray-700/50' : 'border-gray-200'}`}>
                <div className="flex items-center gap-2">
                  <span className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-600'}`}>Intensity:</span>
                  <input
                    type="range"
                    min="0.1"
                    max="2.0"
                    step="0.1"
                    value={intensityScale}
                    onChange={(e) => setIntensityScale(parseFloat(e.target.value))}
                    className="flex-1 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
                    style={{
                      background: `linear-gradient(to right, #22c55e 0%, #22c55e ${((intensityScale - 0.1) / 1.9) * 100}%, #374151 ${((intensityScale - 0.1) / 1.9) * 100}%, #374151 100%)`
                    }}
                  />
                  <span className={`text-xs font-mono w-10 text-right ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                    {intensityScale.toFixed(1)}x
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Monitor Section with Tabs */}
          <section>
            <h2 className={`text-[11px] font-semibold mb-2 uppercase tracking-wider flex items-center gap-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
              <span className="w-1.5 h-1.5 bg-purple-500 rounded-full"></span>
              Monitor
            </h2>

            {/* Tab Navigation */}
            <div className={`flex rounded-lg p-0.5 mb-2 ${theme === 'dark' ? 'bg-gray-900/50 border border-gray-700/30' : 'bg-gray-100 border border-gray-200'}`}>
              <button
                onClick={() => setMonitorTab('color')}
                className={`flex-1 px-2 py-1.5 text-[10px] font-medium rounded-md transition-all ${
                  monitorTab === 'color'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : theme === 'dark' ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50' : 'text-gray-600 hover:text-gray-800 hover:bg-gray-200/50'
                }`}
              >
                Color
              </button>
              <button
                onClick={() => setMonitorTab('spectrum')}
                className={`flex-1 px-2 py-1.5 text-[10px] font-medium rounded-md transition-all ${
                  monitorTab === 'spectrum'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : theme === 'dark' ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50' : 'text-gray-600 hover:text-gray-800 hover:bg-gray-200/50'
                }`}
              >
                Spectrum
              </button>
            </div>

            <div className={`rounded-lg p-3 space-y-3 ${theme === 'dark' ? 'bg-gray-900/50 border border-gray-700/30' : 'bg-white border border-gray-200'}`}>
              {/* Color Tab Content */}
              {monitorTab === 'color' && (
                <>
                  {/* Color Preview */}
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-14 h-14 rounded-lg border-2 shadow-lg ${theme === 'dark' ? 'border-gray-600' : 'border-gray-300'}`}
                      style={{
                        backgroundColor: chromaticity.hexColor,
                        boxShadow: `0 0 20px ${chromaticity.hexColor}40`
                      }}
                    />
                    <div className="flex-1">
                      <p className={`text-[10px] uppercase tracking-wide ${theme === 'dark' ? 'text-gray-500' : 'text-gray-600'}`}>HEX Color</p>
                      <p className={`text-sm font-mono font-semibold ${theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}`}>{chromaticity.hexColor}</p>
                      <p className={`text-[10px] mt-1 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-600'}`}>
                        Peak: <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>{chromaticity.dominantWavelength.toFixed(1)} nm</span>
                        {shiftNm !== 0 && (
                          <span className={`ml-1 ${shiftNm > 0 ? 'text-blue-400' : 'text-orange-400'}`}>
                            ({shiftNm > 0 ? '+' : ''}{shiftNm.toFixed(1)})
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* CIE Coordinates */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className={`rounded p-2 ${theme === 'dark' ? 'bg-gray-800/80' : 'bg-gray-100'}`}>
                      <p className={`text-[10px] mb-1 uppercase tracking-wide ${theme === 'dark' ? 'text-gray-500' : 'text-gray-600'}`}>CIE 1931</p>
                      <div className="space-y-0.5 text-xs font-mono">
                        <p className="flex justify-between">
                          <span className={theme === 'dark' ? 'text-gray-500' : 'text-gray-600'}>x:</span>
                          <span className={theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}>{chromaticity.cie1931.x.toFixed(4)}</span>
                        </p>
                        <p className="flex justify-between">
                          <span className={theme === 'dark' ? 'text-gray-500' : 'text-gray-600'}>y:</span>
                          <span className={theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}>{chromaticity.cie1931.y.toFixed(4)}</span>
                        </p>
                      </div>
                    </div>
                    <div className={`rounded p-2 ${theme === 'dark' ? 'bg-gray-800/80' : 'bg-gray-100'}`}>
                      <p className={`text-[10px] mb-1 uppercase tracking-wide ${theme === 'dark' ? 'text-gray-500' : 'text-gray-600'}`}>CIE 1976</p>
                      <div className="space-y-0.5 text-xs font-mono">
                        <p className="flex justify-between">
                          <span className={theme === 'dark' ? 'text-gray-500' : 'text-gray-600'}>u':</span>
                          <span className={theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}>{chromaticity.cie1976.u.toFixed(4)}</span>
                        </p>
                        <p className="flex justify-between">
                          <span className={theme === 'dark' ? 'text-gray-500' : 'text-gray-600'}>v':</span>
                          <span className={theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}>{chromaticity.cie1976.v.toFixed(4)}</span>
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* XYZ Values */}
                  <div className={`rounded p-2 ${theme === 'dark' ? 'bg-gray-800/80' : 'bg-gray-100'}`}>
                    <p className={`text-[10px] mb-1 uppercase tracking-wide ${theme === 'dark' ? 'text-gray-500' : 'text-gray-600'}`}>XYZ Tristimulus</p>
                    <div className="grid grid-cols-3 gap-1 text-xs font-mono">
                      <span className="text-center"><span className={theme === 'dark' ? 'text-gray-500' : 'text-gray-600'}>X:</span> <span className={theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}>{chromaticity.xyz.X.toFixed(2)}</span></span>
                      <span className="text-center"><span className={theme === 'dark' ? 'text-gray-500' : 'text-gray-600'}>Y:</span> <span className={theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}>{chromaticity.xyz.Y.toFixed(2)}</span></span>
                      <span className="text-center"><span className={theme === 'dark' ? 'text-gray-500' : 'text-gray-600'}>Z:</span> <span className={theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}>{chromaticity.xyz.Z.toFixed(2)}</span></span>
                    </div>
                  </div>
                </>
              )}

              {/* Spectrum Tab Content */}
              {monitorTab === 'spectrum' && (
                <div className="space-y-3">
                  {/* Peak Wavelength */}
                  <div className={`rounded p-2 ${theme === 'dark' ? 'bg-gray-800/80' : 'bg-gray-100'}`}>
                    <p className={`text-[10px] mb-1 uppercase tracking-wide ${theme === 'dark' ? 'text-gray-500' : 'text-gray-600'}`}>Peak Wavelength</p>
                    <p className={`text-lg font-mono font-semibold ${theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}`}>
                      {spectrumAnalysis.peakWavelength.toFixed(1)} <span className={`text-sm ${theme === 'dark' ? 'text-gray-500' : 'text-gray-600'}`}>nm</span>
                    </p>
                    {shiftNm !== 0 && (
                      <p className={`text-[10px] mt-1 ${shiftNm > 0 ? 'text-blue-400' : 'text-orange-400'}`}>
                        Shift: {shiftNm > 0 ? '+' : ''}{shiftNm.toFixed(1)} nm
                      </p>
                    )}
                  </div>

                  {/* FWHM */}
                  <div className={`rounded p-2 ${theme === 'dark' ? 'bg-gray-800/80' : 'bg-gray-100'}`}>
                    <p className={`text-[10px] mb-1 uppercase tracking-wide ${theme === 'dark' ? 'text-gray-500' : 'text-gray-600'}`}>
                      FWHM <span className="normal-case">(50%)</span>
                    </p>
                    <p className={`text-lg font-mono font-semibold ${theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}`}>
                      {spectrumAnalysis.fwhm !== null ? spectrumAnalysis.fwhm.toFixed(1) : 'N/A'} <span className={`text-sm ${theme === 'dark' ? 'text-gray-500' : 'text-gray-600'}`}>nm</span>
                    </p>
                    {spectrumAnalysis.fwhmRange && (
                      <p className={`text-[10px] mt-1 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-600'}`}>
                        {spectrumAnalysis.fwhmRange[0].toFixed(1)} ~ {spectrumAnalysis.fwhmRange[1].toFixed(1)} nm
                      </p>
                    )}
                  </div>

                  {/* FWQM */}
                  <div className={`rounded p-2 ${theme === 'dark' ? 'bg-gray-800/80' : 'bg-gray-100'}`}>
                    <p className={`text-[10px] mb-1 uppercase tracking-wide ${theme === 'dark' ? 'text-gray-500' : 'text-gray-600'}`}>
                      FWQM <span className="normal-case">(25%)</span>
                    </p>
                    <p className={`text-lg font-mono font-semibold ${theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}`}>
                      {spectrumAnalysis.fwqm !== null ? spectrumAnalysis.fwqm.toFixed(1) : 'N/A'} <span className={`text-sm ${theme === 'dark' ? 'text-gray-500' : 'text-gray-600'}`}>nm</span>
                    </p>
                    {spectrumAnalysis.fwqmRange && (
                      <p className={`text-[10px] mt-1 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-600'}`}>
                        {spectrumAnalysis.fwqmRange[0].toFixed(1)} ~ {spectrumAnalysis.fwqmRange[1].toFixed(1)} nm
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>
        </aside>

        {/* Main Canvas Area */}
        {/* Changed overflow-hidden to allow content visibility on narrow viewports */}
        <main className="flex-1 p-2 lg:p-4 flex flex-col min-w-0 overflow-visible lg:overflow-hidden">
          {/* Mode Toggle */}
          <div className="flex justify-center mb-2 lg:mb-3">
            <div className={`inline-flex rounded-lg p-0.5 ${theme === 'dark' ? 'bg-gray-800/80 border border-gray-700/50' : 'bg-gray-200/80 border border-gray-300/50'}`}>
              <button
                onClick={() => setDiagramMode('CIE1931')}
                className={`px-3 lg:px-4 py-1.5 text-xs font-medium rounded-md transition-all duration-200 touch-target
                  ${diagramMode === 'CIE1931'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                    : theme === 'dark' ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50' : 'text-gray-600 hover:text-gray-800 hover:bg-gray-300/50'
                  }`}
              >
                CIE 1931 xy
              </button>
              <button
                onClick={() => setDiagramMode('CIE1976')}
                className={`px-3 lg:px-4 py-1.5 text-xs font-medium rounded-md transition-all duration-200 touch-target
                  ${diagramMode === 'CIE1976'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                    : theme === 'dark' ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50' : 'text-gray-600 hover:text-gray-800 hover:bg-gray-300/50'
                  }`}
              >
                CIE 1976 u'v'
              </button>
            </div>
          </div>

          {/* CIE Diagram - responsive constraints for various viewport sizes */}
          {/* Mobile (<lg): aspect-[1/1.1] to ensure x-axis visibility, with max-h to leave room for inline controls */}
          {/* Desktop (lg+): flex-1 fills remaining space */}
          <div className={`flex-1 rounded-xl overflow-visible shadow-inner aspect-[1/1.1] max-h-[min(55vh,calc(100vw-1rem))] lg:aspect-auto lg:max-h-none lg:min-h-[400px] ${theme === 'dark' ? 'bg-gray-800/30 border border-gray-700/30' : 'bg-gray-100/50 border border-gray-200'}`}>
            <CIEDiagram
              currentPoint={chromaticity.cie1931}
              currentPointUV={chromaticity.cie1976}
              mode={diagramMode}
              enabledGamuts={enabledGamuts}
              snapshots={snapshots}
              onShiftChange={handleDiagramDrag}
              onWavelengthShift={handleWavelengthShift}
              hexColor={chromaticity.hexColor}
              spectrum={spectrum}
              shiftNm={shiftNm}
              theme={theme}
              intensityScale={intensityScale}
              initialZoomTransform={zoomTransform}
              onZoomChange={handleZoomChange}
              customAxisRanges={customAxisRanges}
              onAxisRangeChange={setCustomAxisRanges}
              svgExportRef={handleSvgExportRef}
            />
          </div>

          {/* Interaction hints - Hidden on mobile, shown on lg+ */}
          <p className={`hidden lg:block text-center text-[10px] mt-2 ${theme === 'dark' ? 'text-gray-600' : 'text-gray-500'}`}>
            Drag ridge to shift wavelength | Scroll to zoom | Click and drag to pan | Double-click axis to set range
          </p>
        </main>

        {/* Right Sidebar - Hidden on mobile/tablet, shown on lg+ */}
        {/* Width: 220px on lg, 280px on xl+ for narrow viewport support */}
        <aside className={`hidden lg:block lg:w-[220px] xl:w-[280px] flex-shrink-0 p-3 xl:p-4 overflow-y-auto ${theme === 'dark' ? 'bg-gray-800/50 border-l border-gray-700/50' : 'bg-gray-50 border-l border-gray-200'}`}>
          {/* Gamut Reference */}
          <section className="mb-5">
            <h2 className={`text-[11px] font-semibold mb-2 uppercase tracking-wider flex items-center gap-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
              <span className="w-1.5 h-1.5 bg-orange-500 rounded-full"></span>
              Reference Gamuts
            </h2>
            <div className={`rounded-lg p-3 space-y-1 ${theme === 'dark' ? 'bg-gray-900/50 border border-gray-700/30' : 'bg-white border border-gray-200'}`}>
              {(['sRGB', 'DCI-P3', 'BT.2020', 'AdobeRGB'] as const).map((gamut) => {
                const gamutColors = {
                  'sRGB': { color: '#ef4444', desc: 'Standard RGB' },
                  'DCI-P3': { color: '#22c55e', desc: 'Digital Cinema' },
                  'BT.2020': { color: '#3b82f6', desc: 'Ultra HD' },
                  'AdobeRGB': { color: '#f59e0b', desc: 'Adobe RGB (1998)' },
                };
                return (
                  <label
                    key={gamut}
                    className={`flex items-center gap-2.5 text-xs cursor-pointer rounded-md p-2 -mx-1 transition-colors ${theme === 'dark' ? 'hover:bg-gray-700/30' : 'hover:bg-gray-100'}`}
                  >
                    <input
                      type="checkbox"
                      checked={enabledGamuts.includes(gamut)}
                      onChange={() => toggleGamut(gamut)}
                      className={`w-3.5 h-3.5 rounded text-blue-500 focus:ring-blue-500 focus:ring-offset-0 ${theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}
                    />
                    <span
                      className="w-3 h-3 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: gamutColors[gamut].color }}
                    />
                    <div className="flex-1 min-w-0">
                      <span className={`font-medium ${theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}`}>{gamut}</span>
                      <span className={`ml-1.5 text-[10px] ${theme === 'dark' ? 'text-gray-500' : 'text-gray-600'}`}>{gamutColors[gamut].desc}</span>
                    </div>
                  </label>
                );
              })}
            </div>
          </section>

          {/* Diagram Mode (Duplicate for quick access) */}
          <section className="mb-5">
            <h2 className={`text-[11px] font-semibold mb-2 uppercase tracking-wider flex items-center gap-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
              <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full"></span>
              Diagram Mode
            </h2>
            <div className={`rounded-lg p-2 ${theme === 'dark' ? 'bg-gray-900/50 border border-gray-700/30' : 'bg-white border border-gray-200'}`}>
              <div className="grid grid-cols-2 gap-1">
                <button
                  onClick={() => setDiagramMode('CIE1931')}
                  className={`px-2 py-1.5 text-xs font-medium rounded transition-all ${
                    diagramMode === 'CIE1931'
                      ? 'bg-blue-600 text-white'
                      : theme === 'dark' ? 'bg-gray-800 text-gray-400 hover:bg-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  CIE 1931
                </button>
                <button
                  onClick={() => setDiagramMode('CIE1976')}
                  className={`px-2 py-1.5 text-xs font-medium rounded transition-all ${
                    diagramMode === 'CIE1976'
                      ? 'bg-blue-600 text-white'
                      : theme === 'dark' ? 'bg-gray-800 text-gray-400 hover:bg-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  CIE 1976
                </button>
              </div>
            </div>
          </section>

          {/* Snapshots */}
          <section>
            <h2 className={`text-[11px] font-semibold mb-2 uppercase tracking-wider flex items-center gap-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
              <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full"></span>
              Snapshots
            </h2>
            <SnapshotList
              snapshots={snapshots}
              onRestore={handleRestoreSnapshot}
              onDelete={removeSnapshot}
              onClear={clearSnapshots}
              onSave={handleSaveSnapshot}
              canSave={canAddMore}
              currentShiftNm={shiftNm}
            />
          </section>
        </aside>
      </div>

      {/* Mobile Control Panel - Only shown on mobile/tablet (hidden on lg and above) */}
      {/* Inline panel displayed directly below the graph, no FAB or BottomSheet */}
      <div className="lg:hidden">
        <MobileControlPanel
          shiftNm={shiftNm}
          onShiftChange={handleShiftChange}
          chromaticity={chromaticity}
          spectrumAnalysis={spectrumAnalysis}
          snapshots={snapshots}
          onSaveSnapshot={handleSaveSnapshot}
          onRestoreSnapshot={handleRestoreSnapshot}
          onDeleteSnapshot={removeSnapshot}
          onClearSnapshots={clearSnapshots}
          canAddMore={canAddMore}
          enabledGamuts={enabledGamuts}
          onToggleGamut={toggleGamut}
          theme={theme}
          intensityScale={intensityScale}
          onIntensityScaleChange={setIntensityScale}
          onResetAll={handleResetAll}
          onDataLoaded={handleDataLoaded}
        />
      </div>

      {/* Export Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        onExport={handleExport}
        snapshotCount={snapshots.length}
        theme={theme}
      />
    </div>
  );
}

export default App;
