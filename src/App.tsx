import { useState, useCallback, useMemo } from 'react';
import { DataInput } from './components/DataInput';
import { CIEDiagram } from './components/CIEDiagram';
import { SnapshotList } from './components/SnapshotList';
import { MobileControls } from './components/mobile/MobileControls';
import { useSnapshots } from './hooks/useSnapshots';
import { useTheme } from './hooks/useTheme';
import { useIsMobile } from './hooks/useMediaQuery';
import { calculateChromaticity, shiftSpectrum, PRESET_GREEN } from './lib';
import type { SpectrumPoint, ChromaticityResult, DiagramMode, GamutType } from './types/spectrum';

function App() {
  const { theme, toggleTheme } = useTheme();
  const isMobile = useIsMobile();
  const [spectrum, setSpectrum] = useState<SpectrumPoint[]>(PRESET_GREEN);
  const [shiftNm, setShiftNm] = useState(0);
  const [diagramMode, setDiagramMode] = useState<DiagramMode>('CIE1931');
  const [enabledGamuts, setEnabledGamuts] = useState<GamutType[]>(['sRGB']);

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
            <h1 className="text-base lg:text-xl font-bold text-blue-400 tracking-tight truncate">
              {isMobile ? 'ISCV' : 'Interactive Spectrum-to-Color Visualizer'}
            </h1>
            <p className={`text-[10px] lg:text-xs mt-0.5 truncate ${theme === 'dark' ? 'text-gray-500' : 'text-gray-600'}`}>
              {isMobile ? 'Spectrum Analysis Tool' : 'ISCV - Emission Spectrum Analysis Tool for OLED/Display Research'}
            </p>
          </div>
          <div className="flex items-center gap-2 lg:gap-4 flex-shrink-0">
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
            {!isMobile && (
              <div className={`text-xs ${theme === 'dark' ? 'text-gray-600' : 'text-gray-500'}`}>
                v{__APP_VERSION__}
              </div>
            )}
          </div>
        </div>
      </header>

      <div className={`flex flex-col lg:flex-row ${isMobile ? 'h-[calc(100vh-48px)]' : 'h-[calc(100vh-56px)]'}`}>
        {/* Left Sidebar - Hidden on mobile, 280px on desktop */}
        <aside className={`hidden lg:block w-[280px] flex-shrink-0 p-4 overflow-y-auto ${theme === 'dark' ? 'bg-gray-800/50 border-r border-gray-700/50' : 'bg-gray-50 border-r border-gray-200'}`}>
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
            </div>
          </section>

          {/* Color Monitor */}
          <section>
            <h2 className={`text-[11px] font-semibold mb-2 uppercase tracking-wider flex items-center gap-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
              <span className="w-1.5 h-1.5 bg-purple-500 rounded-full"></span>
              Monitor
            </h2>
            <div className={`rounded-lg p-3 space-y-3 ${theme === 'dark' ? 'bg-gray-900/50 border border-gray-700/30' : 'bg-white border border-gray-200'}`}>
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
            </div>
          </section>
        </aside>

        {/* Main Canvas Area */}
        <main className="flex-1 p-2 lg:p-4 flex flex-col min-w-0 overflow-hidden">
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

          {/* CIE Diagram */}
          <div className={`flex-1 rounded-xl overflow-hidden shadow-inner ${theme === 'dark' ? 'bg-gray-800/30 border border-gray-700/30' : 'bg-gray-100/50 border border-gray-200'}`}>
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
            />
          </div>

          {/* Interaction hints - Hidden on mobile */}
          {!isMobile && (
            <p className={`text-center text-[10px] mt-2 ${theme === 'dark' ? 'text-gray-600' : 'text-gray-500'}`}>
              Drag ridge to shift wavelength | Scroll to zoom | Click and drag to pan
            </p>
          )}
        </main>

        {/* Right Sidebar - Hidden on mobile, 280px on desktop */}
        <aside className={`hidden lg:block w-[280px] flex-shrink-0 p-4 overflow-y-auto ${theme === 'dark' ? 'bg-gray-800/50 border-l border-gray-700/50' : 'bg-gray-50 border-l border-gray-200'}`}>
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

      {/* Mobile Controls - Only shown on mobile */}
      {isMobile && (
        <MobileControls
          shiftNm={shiftNm}
          onShiftChange={handleShiftChange}
          chromaticity={chromaticity}
          snapshots={snapshots}
          onSaveSnapshot={handleSaveSnapshot}
          onRestoreSnapshot={handleRestoreSnapshot}
          onDeleteSnapshot={removeSnapshot}
          onClearSnapshots={clearSnapshots}
          canAddMore={canAddMore}
          enabledGamuts={enabledGamuts}
          onToggleGamut={toggleGamut}
          theme={theme}
        />
      )}
    </div>
  );
}

export default App;
