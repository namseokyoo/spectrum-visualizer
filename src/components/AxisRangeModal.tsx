/**
 * Axis Range Modal Component
 *
 * Modal dialog for setting custom axis range (min/max) values
 * Triggered by double-clicking on X or Y axis
 */

import { useState, useEffect, useCallback } from 'react';

interface AxisRangeModalProps {
  isOpen: boolean;
  axis: 'x' | 'y';
  currentMin: number;
  currentMax: number;
  onApply: (min: number, max: number) => void;
  onClose: () => void;
  theme?: 'dark' | 'light';
}

export function AxisRangeModal({
  isOpen,
  axis,
  currentMin,
  currentMax,
  onApply,
  onClose,
  theme = 'dark',
}: AxisRangeModalProps) {
  const [min, setMin] = useState(currentMin.toFixed(3));
  const [max, setMax] = useState(currentMax.toFixed(3));
  const [error, setError] = useState<string | null>(null);

  // Reset values when modal opens or axis changes
  // This is intentional - we want to sync state with props when modal opens
  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMin(currentMin.toFixed(3));
       
      setMax(currentMax.toFixed(3));
       
      setError(null);
    }
  }, [isOpen, currentMin, currentMax]);

  // Validate and apply range
  const handleApply = useCallback(() => {
    const minVal = parseFloat(min);
    const maxVal = parseFloat(max);

    if (isNaN(minVal) || isNaN(maxVal)) {
      setError('Please enter valid numbers');
      return;
    }

    if (minVal >= maxVal) {
      setError('Min must be less than Max');
      return;
    }

    const range = maxVal - minVal;
    if (range < 0.01) {
      setError('Range must be at least 0.01');
      return;
    }

    if (range > 2) {
      setError('Range too large (max 2.0)');
      return;
    }

    setError(null);
    onApply(minVal, maxVal);
    onClose();
  }, [min, max, onApply, onClose]);

  // Handle Enter key
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleApply();
      } else if (e.key === 'Escape') {
        onClose();
      }
    },
    [handleApply, onClose]
  );

  if (!isOpen) return null;

  const axisLabel = axis.toUpperCase();
  const axisLabelFull = axis === 'x' ? 'X (x or u\')' : 'Y (y or v\')';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className={`relative rounded-xl shadow-2xl w-72 p-4 ${
          theme === 'dark'
            ? 'bg-gray-800 border border-gray-700'
            : 'bg-white border border-gray-200'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3
            className={`text-sm font-semibold ${
              theme === 'dark' ? 'text-gray-100' : 'text-gray-900'
            }`}
          >
            Set {axisLabel} Axis Range
          </h3>
          <button
            onClick={onClose}
            className={`p-1 rounded-lg transition-colors ${
              theme === 'dark'
                ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-200'
                : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
            }`}
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Axis label hint */}
        <p
          className={`text-[10px] mb-3 ${
            theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
          }`}
        >
          Axis: {axisLabelFull}
        </p>

        {/* Input fields */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <label
              className={`text-xs w-10 ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}
            >
              Min:
            </label>
            <input
              type="number"
              step="0.01"
              value={min}
              onChange={(e) => {
                setMin(e.target.value);
                setError(null);
              }}
              onKeyDown={handleKeyDown}
              autoFocus
              className={`flex-1 px-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                theme === 'dark'
                  ? 'bg-gray-900 border-gray-600 text-white placeholder-gray-500'
                  : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400'
              }`}
              placeholder="e.g., 0.0"
            />
          </div>

          <div className="flex items-center gap-3">
            <label
              className={`text-xs w-10 ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}
            >
              Max:
            </label>
            <input
              type="number"
              step="0.01"
              value={max}
              onChange={(e) => {
                setMax(e.target.value);
                setError(null);
              }}
              onKeyDown={handleKeyDown}
              className={`flex-1 px-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                theme === 'dark'
                  ? 'bg-gray-900 border-gray-600 text-white placeholder-gray-500'
                  : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400'
              }`}
              placeholder="e.g., 0.8"
            />
          </div>
        </div>

        {/* Error message */}
        {error && (
          <p className="mt-2 text-xs text-red-400">{error}</p>
        )}

        {/* Buttons */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={onClose}
            className={`flex-1 px-4 py-2 text-xs font-medium rounded-lg transition-colors ${
              theme === 'dark'
                ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            className="flex-1 px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors"
          >
            Apply
          </button>
        </div>

        {/* Hint */}
        <p
          className={`mt-3 text-[10px] text-center ${
            theme === 'dark' ? 'text-gray-600' : 'text-gray-400'
          }`}
        >
          Press Enter to apply, Esc to cancel
        </p>
      </div>
    </div>
  );
}

export default AxisRangeModal;
