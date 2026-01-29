/**
 * SnapshotList Component
 *
 * Displays saved color coordinate snapshots
 * Allows restore, delete, and comparison operations
 */

import { useMemo } from 'react';
import type { Snapshot } from '../types/spectrum';

interface SnapshotListProps {
  snapshots: Snapshot[];
  onRestore: (snapshot: Snapshot) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
  onSave: () => void;
  canSave: boolean;
  currentShiftNm: number;
}

export function SnapshotList({
  snapshots,
  onRestore,
  onDelete,
  onClear,
  onSave,
  canSave,
  currentShiftNm,
}: SnapshotListProps) {
  // Format timestamp
  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  // Check if current state matches a snapshot
  const matchingSnapshotId = useMemo(() => {
    const tolerance = 0.01;
    const matching = snapshots.find(
      (s) => Math.abs(s.shiftNm - currentShiftNm) < tolerance
    );
    return matching?.id;
  }, [snapshots, currentShiftNm]);

  return (
    <div className="space-y-2">
      {/* Save Button */}
      <button
        onClick={onSave}
        disabled={!canSave}
        className={`w-full py-1.5 px-3 rounded-lg font-medium text-xs transition-all
          ${
            canSave
              ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-sm shadow-blue-600/20'
              : 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700/50'
          }`}
      >
        {canSave ? 'Save Snapshot' : 'Max Snapshots (10)'}
      </button>

      {/* Snapshots List */}
      {snapshots.length === 0 ? (
        <div className="text-center py-4 text-gray-500">
          <p className="text-[10px]">No snapshots saved</p>
          <p className="text-[9px] mt-0.5 text-gray-600">Save to capture current state</p>
        </div>
      ) : (
        <div className="space-y-1.5 max-h-[280px] overflow-y-auto pr-0.5">
          {snapshots.map((snapshot, index) => (
            <SnapshotItem
              key={snapshot.id}
              snapshot={snapshot}
              index={index}
              isActive={snapshot.id === matchingSnapshotId}
              onRestore={() => onRestore(snapshot)}
              onDelete={() => onDelete(snapshot.id)}
              formatTime={formatTime}
            />
          ))}
        </div>
      )}

      {/* Clear All Button */}
      {snapshots.length > 0 && (
        <button
          onClick={onClear}
          className="w-full py-1 px-2 text-[10px] text-gray-500 hover:text-red-400
                     hover:bg-red-900/20 rounded transition-colors"
        >
          Clear All
        </button>
      )}
    </div>
  );
}

interface SnapshotItemProps {
  snapshot: Snapshot;
  index: number;
  isActive: boolean;
  onRestore: () => void;
  onDelete: () => void;
  formatTime: (timestamp: number) => string;
}

function SnapshotItem({
  snapshot,
  index,
  isActive,
  onRestore,
  onDelete,
  formatTime,
}: SnapshotItemProps) {
  const { chromaticity, shiftNm } = snapshot;

  return (
    <div
      className={`relative bg-gray-900/50 rounded-lg p-2.5 border transition-all
        ${isActive ? 'border-blue-500/50 bg-blue-900/10' : 'border-gray-700/30 hover:border-gray-600/50'}`}
    >
      {/* Active indicator */}
      {isActive && (
        <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
      )}

      {/* Header: Index and Color Preview */}
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-7 h-7 rounded-md border border-gray-600/50 flex-shrink-0"
          style={{ backgroundColor: chromaticity.hexColor }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-medium text-gray-200">
              #{index + 1}
            </span>
            <span className="text-[9px] text-gray-600">
              {formatTime(snapshot.timestamp)}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono text-gray-400">
              {chromaticity.hexColor}
            </span>
            <span className={`text-[9px] ${shiftNm >= 0 ? 'text-blue-400' : 'text-orange-400'}`}>
              {shiftNm > 0 ? '+' : ''}{shiftNm.toFixed(1)}nm
            </span>
          </div>
        </div>
      </div>

      {/* Compact Data Grid */}
      <div className="grid grid-cols-4 gap-1 text-[9px] mb-2 font-mono">
        <span className="text-gray-500">x:{chromaticity.cie1931.x.toFixed(3)}</span>
        <span className="text-gray-500">y:{chromaticity.cie1931.y.toFixed(3)}</span>
        <span className="text-gray-500">u':{chromaticity.cie1976.u.toFixed(3)}</span>
        <span className="text-gray-500">v':{chromaticity.cie1976.v.toFixed(3)}</span>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-1.5">
        <button
          onClick={onRestore}
          disabled={isActive}
          className={`flex-1 py-1 text-[10px] rounded transition-all
            ${
              isActive
                ? 'bg-gray-800 text-gray-600 cursor-default'
                : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
            }`}
        >
          {isActive ? 'Current' : 'Restore'}
        </button>
        <button
          onClick={onDelete}
          className="px-2 py-1 text-[10px] bg-gray-800 hover:bg-red-900/30
                     text-gray-500 hover:text-red-400 rounded transition-all"
        >
          Del
        </button>
      </div>
    </div>
  );
}

export default SnapshotList;
