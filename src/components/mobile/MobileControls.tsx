import { useState, useCallback } from 'react';
import { BottomSheet } from './BottomSheet';
import type { Snapshot, GamutType, ChromaticityResult } from '../../types/spectrum';

interface MobileControlsProps {
  // Wavelength shift
  shiftNm: number;
  onShiftChange: (value: number) => void;
  // Chromaticity display
  chromaticity: ChromaticityResult;
  // Snapshots
  snapshots: Snapshot[];
  onSaveSnapshot: () => void;
  onRestoreSnapshot: (snapshot: Snapshot) => void;
  onDeleteSnapshot: (id: string) => void;
  onClearSnapshots: () => void;
  canAddMore: boolean;
  // Gamuts
  enabledGamuts: GamutType[];
  onToggleGamut: (gamut: GamutType) => void;
  // Theme
  theme?: 'dark' | 'light';
  // Intensity scale
  intensityScale?: number;
  onIntensityScaleChange?: (value: number) => void;
  // Reset all
  onResetAll?: () => void;
}

type ControlTab = 'shift' | 'snapshot' | 'gamut' | 'info';

/**
 * MobileControls - FAB + BottomSheet for mobile interface
 * Provides access to all controls in a touch-friendly format
 */
export function MobileControls({
  shiftNm,
  onShiftChange,
  chromaticity,
  snapshots,
  onSaveSnapshot,
  onRestoreSnapshot,
  onDeleteSnapshot,
  onClearSnapshots,
  canAddMore,
  enabledGamuts,
  onToggleGamut,
  theme = 'dark',
  intensityScale = 1.0,
  onIntensityScaleChange,
  onResetAll,
}: MobileControlsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ControlTab>('shift');

  // Theme colors
  const bgColor = theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100';
  const textColor = theme === 'dark' ? 'text-gray-100' : 'text-gray-900';
  const mutedColor = theme === 'dark' ? 'text-gray-400' : 'text-gray-600';
  const borderColor = theme === 'dark' ? 'border-gray-700' : 'border-gray-300';
  const inputBg = theme === 'dark' ? 'bg-gray-900' : 'bg-white';

  const handleOpenSheet = useCallback(() => {
    setIsOpen(true);
  }, []);

  const handleCloseSheet = useCallback(() => {
    setIsOpen(false);
  }, []);

  const gamutColors: Record<GamutType, { color: string; desc: string }> = {
    'sRGB': { color: '#ef4444', desc: 'Standard RGB' },
    'DCI-P3': { color: '#22c55e', desc: 'Digital Cinema' },
    'BT.2020': { color: '#3b82f6', desc: 'Ultra HD' },
    'AdobeRGB': { color: '#f59e0b', desc: 'Adobe RGB (1998)' },
  };

  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={handleOpenSheet}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-blue-600 text-white shadow-lg shadow-blue-600/30 flex items-center justify-center z-40 touch-target active:scale-95 transition-transform"
        aria-label="Open controls"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
        </svg>
      </button>

      {/* Quick Shift Indicator */}
      {shiftNm !== 0 && !isOpen && (
        <div className={`fixed bottom-6 left-6 px-3 py-2 rounded-full ${bgColor} ${textColor} shadow-lg text-sm font-mono z-40`}>
          <span className={shiftNm > 0 ? 'text-blue-400' : 'text-orange-400'}>
            {shiftNm > 0 ? '+' : ''}{shiftNm.toFixed(1)}nm
          </span>
        </div>
      )}

      {/* Bottom Sheet */}
      <BottomSheet
        isOpen={isOpen}
        onClose={handleCloseSheet}
        title="Controls"
        theme={theme}
      >
        {/* Tab Navigation */}
        <div className={`flex gap-1 mb-4 p-1 ${bgColor} rounded-lg`}>
          {[
            { key: 'shift' as const, label: 'Shift', icon: '↔' },
            { key: 'snapshot' as const, label: 'Snap', icon: '📸' },
            { key: 'gamut' as const, label: 'Gamut', icon: '△' },
            { key: 'info' as const, label: 'Info', icon: 'ℹ' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2 px-2 rounded-md text-xs font-medium transition-colors touch-target
                ${activeTab === tab.key
                  ? 'bg-blue-600 text-white'
                  : `${mutedColor} hover:bg-gray-700/50`
                }`}
            >
              <span className="mr-1">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Shift Tab */}
        {activeTab === 'shift' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className={mutedColor}>Wavelength Shift</span>
              <span className={`font-mono ${textColor}`}>
                {shiftNm > 0 ? '+' : ''}{shiftNm.toFixed(1)} nm
              </span>
            </div>

            {/* Large Slider */}
            <input
              type="range"
              min="-100"
              max="100"
              step="0.5"
              value={shiftNm}
              onChange={(e) => onShiftChange(parseFloat(e.target.value))}
              className="w-full h-8 accent-blue-500 touch-target"
              style={{
                background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((shiftNm + 100) / 200) * 100}%, #374151 ${((shiftNm + 100) / 200) * 100}%, #374151 100%)`
              }}
            />

            {/* Quick Adjust Buttons */}
            <div className="grid grid-cols-5 gap-2">
              {[-10, -1, 0, 1, 10].map((delta) => (
                <button
                  key={delta}
                  onClick={() => delta === 0 ? onShiftChange(0) : onShiftChange(shiftNm + delta)}
                  className={`py-3 rounded-lg text-sm font-medium touch-target
                    ${delta === 0
                      ? 'bg-gray-700 text-gray-200'
                      : 'bg-gray-800 text-gray-300 active:bg-gray-700'
                    }`}
                >
                  {delta === 0 ? 'Reset' : `${delta > 0 ? '+' : ''}${delta}`}
                </button>
              ))}
            </div>

            {/* Intensity Scale */}
            <div className={`p-3 rounded-lg ${inputBg} ${borderColor} border`}>
              <div className="flex items-center justify-between mb-2">
                <span className={mutedColor}>Intensity Scale</span>
                <span className={`font-mono ${textColor}`}>{intensityScale.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="2.0"
                step="0.1"
                value={intensityScale}
                onChange={(e) => onIntensityScaleChange?.(parseFloat(e.target.value))}
                className="w-full h-8 accent-green-500 touch-target"
                style={{
                  background: `linear-gradient(to right, #22c55e 0%, #22c55e ${((intensityScale - 0.1) / 1.9) * 100}%, #374151 ${((intensityScale - 0.1) / 1.9) * 100}%, #374151 100%)`
                }}
              />
            </div>

            {/* Color Preview */}
            <div className={`flex items-center gap-3 p-3 rounded-lg ${inputBg} ${borderColor} border`}>
              <div
                className="w-12 h-12 rounded-lg border-2 border-white/20"
                style={{
                  backgroundColor: chromaticity.hexColor,
                  boxShadow: `0 0 20px ${chromaticity.hexColor}40`
                }}
              />
              <div className="flex-1">
                <p className={`font-mono text-sm ${textColor}`}>{chromaticity.hexColor}</p>
                <p className={`text-xs ${mutedColor}`}>
                  Peak: {chromaticity.dominantWavelength.toFixed(1)} nm
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Snapshot Tab */}
        {activeTab === 'snapshot' && (
          <div className="space-y-4">
            <button
              onClick={onSaveSnapshot}
              disabled={!canAddMore}
              className={`w-full py-3 rounded-lg font-medium text-sm touch-target
                ${canAddMore
                  ? 'bg-blue-600 text-white active:bg-blue-500'
                  : 'bg-gray-700 text-gray-500'
                }`}
            >
              {canAddMore ? 'Save Snapshot' : 'Max Snapshots (10)'}
            </button>

            {snapshots.length === 0 ? (
              <p className={`text-center py-8 ${mutedColor}`}>
                No snapshots saved yet
              </p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {snapshots.map((snapshot, index) => (
                  <div
                    key={snapshot.id}
                    className={`flex items-center gap-3 p-3 rounded-lg ${inputBg} ${borderColor} border`}
                  >
                    <div
                      className="w-10 h-10 rounded-lg flex-shrink-0"
                      style={{ backgroundColor: snapshot.chromaticity.hexColor }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm ${textColor}`}>#{index + 1}</span>
                        <span className={`text-xs ${mutedColor}`}>
                          {formatTime(snapshot.timestamp)}
                        </span>
                      </div>
                      <p className={`text-xs font-mono ${mutedColor}`}>
                        {snapshot.shiftNm > 0 ? '+' : ''}{snapshot.shiftNm.toFixed(1)}nm
                      </p>
                    </div>
                    <button
                      onClick={() => onRestoreSnapshot(snapshot)}
                      className="px-3 py-2 text-xs bg-gray-700 text-gray-300 rounded-lg touch-target"
                    >
                      Restore
                    </button>
                    <button
                      onClick={() => onDeleteSnapshot(snapshot.id)}
                      className="px-2 py-2 text-xs text-red-400 touch-target"
                    >
                      Del
                    </button>
                  </div>
                ))}
              </div>
            )}

            {snapshots.length > 0 && (
              <button
                onClick={onClearSnapshots}
                className="w-full py-2 text-sm text-red-400 active:bg-red-900/20 rounded-lg"
              >
                Clear All
              </button>
            )}
          </div>
        )}

        {/* Gamut Tab */}
        {activeTab === 'gamut' && (
          <div className="space-y-2">
            {(['sRGB', 'DCI-P3', 'BT.2020', 'AdobeRGB'] as const).map((gamut) => (
              <label
                key={gamut}
                className={`flex items-center gap-3 p-4 rounded-lg ${inputBg} ${borderColor} border cursor-pointer touch-target`}
              >
                <input
                  type="checkbox"
                  checked={enabledGamuts.includes(gamut)}
                  onChange={() => onToggleGamut(gamut)}
                  className="w-5 h-5 rounded accent-blue-500"
                />
                <span
                  className="w-5 h-5 rounded flex-shrink-0"
                  style={{ backgroundColor: gamutColors[gamut].color }}
                />
                <div className="flex-1">
                  <span className={`font-medium ${textColor}`}>{gamut}</span>
                  <p className={`text-xs ${mutedColor}`}>{gamutColors[gamut].desc}</p>
                </div>
              </label>
            ))}
          </div>
        )}

        {/* Info Tab */}
        {activeTab === 'info' && (
          <div className="space-y-4">
            {/* CIE 1931 */}
            <div className={`p-4 rounded-lg ${inputBg} ${borderColor} border`}>
              <h3 className={`text-sm font-medium mb-2 ${textColor}`}>CIE 1931 xy</h3>
              <div className="grid grid-cols-2 gap-4 font-mono text-sm">
                <div className="flex justify-between">
                  <span className={mutedColor}>x:</span>
                  <span className={textColor}>{chromaticity.cie1931.x.toFixed(4)}</span>
                </div>
                <div className="flex justify-between">
                  <span className={mutedColor}>y:</span>
                  <span className={textColor}>{chromaticity.cie1931.y.toFixed(4)}</span>
                </div>
              </div>
            </div>

            {/* CIE 1976 */}
            <div className={`p-4 rounded-lg ${inputBg} ${borderColor} border`}>
              <h3 className={`text-sm font-medium mb-2 ${textColor}`}>CIE 1976 u'v'</h3>
              <div className="grid grid-cols-2 gap-4 font-mono text-sm">
                <div className="flex justify-between">
                  <span className={mutedColor}>u':</span>
                  <span className={textColor}>{chromaticity.cie1976.u.toFixed(4)}</span>
                </div>
                <div className="flex justify-between">
                  <span className={mutedColor}>v':</span>
                  <span className={textColor}>{chromaticity.cie1976.v.toFixed(4)}</span>
                </div>
              </div>
            </div>

            {/* XYZ Tristimulus */}
            <div className={`p-4 rounded-lg ${inputBg} ${borderColor} border`}>
              <h3 className={`text-sm font-medium mb-2 ${textColor}`}>XYZ Tristimulus</h3>
              <div className="grid grid-cols-3 gap-2 font-mono text-sm">
                <div className="text-center">
                  <span className={mutedColor}>X</span>
                  <p className={textColor}>{chromaticity.xyz.X.toFixed(2)}</p>
                </div>
                <div className="text-center">
                  <span className={mutedColor}>Y</span>
                  <p className={textColor}>{chromaticity.xyz.Y.toFixed(2)}</p>
                </div>
                <div className="text-center">
                  <span className={mutedColor}>Z</span>
                  <p className={textColor}>{chromaticity.xyz.Z.toFixed(2)}</p>
                </div>
              </div>
            </div>

            {/* Reset All Button */}
            {onResetAll && (
              <button
                onClick={onResetAll}
                className="w-full py-3 rounded-lg font-medium text-sm touch-target bg-red-600/20 text-red-400 active:bg-red-600/30 border border-red-600/30"
              >
                Reset All Settings
              </button>
            )}
          </div>
        )}
      </BottomSheet>
    </>
  );
}

export default MobileControls;
