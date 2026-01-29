import { useState, useCallback, useMemo } from 'react';
import { DataInput } from './components/DataInput';
import { CIEDiagram } from './components/CIEDiagram';
import { SnapshotList } from './components/SnapshotList';
import { useSnapshots } from './hooks/useSnapshots';
import { calculateChromaticity, shiftSpectrum, PRESET_GREEN } from './lib';
import type { SpectrumPoint, ChromaticityResult, DiagramMode, GamutType } from './types/spectrum';

function App() {
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
    <div className="min-h-screen min-w-[1280px] bg-gray-900 text-gray-100">
      {/* Header */}
      <header className="bg-gray-800/80 backdrop-blur-sm border-b border-gray-700/50 px-6 py-3 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-blue-400 tracking-tight">
              Interactive Spectrum-to-Color Visualizer
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              ISCV - Emission Spectrum Analysis Tool for OLED/Display Research
            </p>
          </div>
          <div className="text-xs text-gray-600">
            v1.0.0
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-56px)]">
        {/* Left Sidebar - 280px fixed width */}
        <aside className="w-[280px] flex-shrink-0 bg-gray-800/50 border-r border-gray-700/50 p-4 overflow-y-auto">
          {/* Data Input Section */}
          <section className="mb-5">
            <h2 className="text-[11px] font-semibold text-gray-400 mb-2 uppercase tracking-wider flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
              Input
            </h2>
            <DataInput onDataLoaded={handleDataLoaded} />
          </section>

          {/* Wavelength Shift Control */}
          <section className="mb-5">
            <h2 className="text-[11px] font-semibold text-gray-400 mb-2 uppercase tracking-wider flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
              Control
            </h2>
            <div className="bg-gray-900/50 rounded-lg p-3 space-y-3 border border-gray-700/30">
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
                  <span className="text-xs text-gray-500">Shift:</span>
                  <input
                    type="number"
                    value={shiftNm}
                    onChange={(e) => handleShiftChange(parseFloat(e.target.value) || 0)}
                    step="0.5"
                    min="-100"
                    max="100"
                    className="w-16 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs text-center focus:outline-none focus:border-blue-500"
                  />
                  <span className="text-xs text-gray-500">nm</span>
                </div>
                <button
                  onClick={() => setShiftNm(0)}
                  className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded transition-colors text-gray-300"
                >
                  Reset
                </button>
              </div>
            </div>
          </section>

          {/* Color Monitor */}
          <section>
            <h2 className="text-[11px] font-semibold text-gray-400 mb-2 uppercase tracking-wider flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-purple-500 rounded-full"></span>
              Monitor
            </h2>
            <div className="bg-gray-900/50 rounded-lg p-3 space-y-3 border border-gray-700/30">
              {/* Color Preview */}
              <div className="flex items-center gap-3">
                <div
                  className="w-14 h-14 rounded-lg border-2 border-gray-600 shadow-lg"
                  style={{
                    backgroundColor: chromaticity.hexColor,
                    boxShadow: `0 0 20px ${chromaticity.hexColor}40`
                  }}
                />
                <div className="flex-1">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide">HEX Color</p>
                  <p className="text-sm font-mono font-semibold text-gray-200">{chromaticity.hexColor}</p>
                  <p className="text-[10px] text-gray-500 mt-1">
                    Peak: <span className="text-gray-300">{chromaticity.dominantWavelength.toFixed(1)} nm</span>
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
                <div className="bg-gray-800/80 rounded p-2">
                  <p className="text-[10px] text-gray-500 mb-1 uppercase tracking-wide">CIE 1931</p>
                  <div className="space-y-0.5 text-xs font-mono">
                    <p className="flex justify-between">
                      <span className="text-gray-500">x:</span>
                      <span className="text-gray-200">{chromaticity.cie1931.x.toFixed(4)}</span>
                    </p>
                    <p className="flex justify-between">
                      <span className="text-gray-500">y:</span>
                      <span className="text-gray-200">{chromaticity.cie1931.y.toFixed(4)}</span>
                    </p>
                  </div>
                </div>
                <div className="bg-gray-800/80 rounded p-2">
                  <p className="text-[10px] text-gray-500 mb-1 uppercase tracking-wide">CIE 1976</p>
                  <div className="space-y-0.5 text-xs font-mono">
                    <p className="flex justify-between">
                      <span className="text-gray-500">u':</span>
                      <span className="text-gray-200">{chromaticity.cie1976.u.toFixed(4)}</span>
                    </p>
                    <p className="flex justify-between">
                      <span className="text-gray-500">v':</span>
                      <span className="text-gray-200">{chromaticity.cie1976.v.toFixed(4)}</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* XYZ Values */}
              <div className="bg-gray-800/80 rounded p-2">
                <p className="text-[10px] text-gray-500 mb-1 uppercase tracking-wide">XYZ Tristimulus</p>
                <div className="grid grid-cols-3 gap-1 text-xs font-mono">
                  <span className="text-center"><span className="text-gray-500">X:</span> <span className="text-gray-200">{chromaticity.xyz.X.toFixed(2)}</span></span>
                  <span className="text-center"><span className="text-gray-500">Y:</span> <span className="text-gray-200">{chromaticity.xyz.Y.toFixed(2)}</span></span>
                  <span className="text-center"><span className="text-gray-500">Z:</span> <span className="text-gray-200">{chromaticity.xyz.Z.toFixed(2)}</span></span>
                </div>
              </div>
            </div>
          </section>
        </aside>

        {/* Main Canvas Area */}
        <main className="flex-1 p-4 flex flex-col min-w-0">
          {/* Mode Toggle */}
          <div className="flex justify-center mb-3">
            <div className="inline-flex bg-gray-800/80 rounded-lg p-0.5 border border-gray-700/50">
              <button
                onClick={() => setDiagramMode('CIE1931')}
                className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all duration-200
                  ${diagramMode === 'CIE1931'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
                  }`}
              >
                CIE 1931 xy
              </button>
              <button
                onClick={() => setDiagramMode('CIE1976')}
                className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all duration-200
                  ${diagramMode === 'CIE1976'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
                  }`}
              >
                CIE 1976 u'v'
              </button>
            </div>
          </div>

          {/* CIE Diagram */}
          <div className="flex-1 bg-gray-800/30 rounded-xl overflow-hidden border border-gray-700/30 shadow-inner">
            <CIEDiagram
              currentPoint={chromaticity.cie1931}
              currentPointUV={chromaticity.cie1976}
              mode={diagramMode}
              enabledGamuts={enabledGamuts}
              snapshots={snapshots}
              onShiftChange={handleDiagramDrag}
              hexColor={chromaticity.hexColor}
              spectrum={spectrum}
              shiftNm={shiftNm}
            />
          </div>

          {/* Drag hint */}
          <p className="text-center text-[10px] text-gray-600 mt-2">
            Drag the spectrum ridge on the locus to shift wavelength interactively
          </p>
        </main>

        {/* Right Sidebar - 280px fixed width */}
        <aside className="w-[280px] flex-shrink-0 bg-gray-800/50 border-l border-gray-700/50 p-4 overflow-y-auto">
          {/* Gamut Reference */}
          <section className="mb-5">
            <h2 className="text-[11px] font-semibold text-gray-400 mb-2 uppercase tracking-wider flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-orange-500 rounded-full"></span>
              Reference Gamuts
            </h2>
            <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700/30 space-y-1">
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
                    className="flex items-center gap-2.5 text-xs cursor-pointer hover:bg-gray-700/30 rounded-md p-2 -mx-1 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={enabledGamuts.includes(gamut)}
                      onChange={() => toggleGamut(gamut)}
                      className="w-3.5 h-3.5 rounded bg-gray-700 border-gray-600 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                    />
                    <span
                      className="w-3 h-3 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: gamutColors[gamut].color }}
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-gray-200 font-medium">{gamut}</span>
                      <span className="text-gray-500 ml-1.5 text-[10px]">{gamutColors[gamut].desc}</span>
                    </div>
                  </label>
                );
              })}
            </div>
          </section>

          {/* Diagram Mode (Duplicate for quick access) */}
          <section className="mb-5">
            <h2 className="text-[11px] font-semibold text-gray-400 mb-2 uppercase tracking-wider flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full"></span>
              Diagram Mode
            </h2>
            <div className="bg-gray-900/50 rounded-lg p-2 border border-gray-700/30">
              <div className="grid grid-cols-2 gap-1">
                <button
                  onClick={() => setDiagramMode('CIE1931')}
                  className={`px-2 py-1.5 text-xs font-medium rounded transition-all ${
                    diagramMode === 'CIE1931'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  CIE 1931
                </button>
                <button
                  onClick={() => setDiagramMode('CIE1976')}
                  className={`px-2 py-1.5 text-xs font-medium rounded transition-all ${
                    diagramMode === 'CIE1976'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  CIE 1976
                </button>
              </div>
            </div>
          </section>

          {/* Snapshots */}
          <section>
            <h2 className="text-[11px] font-semibold text-gray-400 mb-2 uppercase tracking-wider flex items-center gap-2">
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
    </div>
  );
}

export default App;
