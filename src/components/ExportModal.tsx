/**
 * ExportModal Component
 *
 * Modal dialog for exporting spectrum data and diagrams
 * Supports CSV, SVG, PNG, and JSON format selection with snapshot inclusion option
 */

import { useState, useCallback } from 'react';

export type ExportFormat = 'csv' | 'svg' | 'png' | 'json';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (format: ExportFormat, includeSnapshots: boolean) => void | Promise<void>;
  snapshotCount: number;
  theme?: 'dark' | 'light';
}

/** Format metadata for display */
const FORMAT_OPTIONS: {
  key: ExportFormat;
  label: string;
  subtitle: string;
  description: string;
  snapshotDescription: (count: number) => string;
  supportsSnapshots: boolean;
  icon: 'document' | 'image' | 'photo' | 'code';
}[] = [
  {
    key: 'csv',
    label: 'CSV',
    subtitle: 'Spectrum Data',
    description: 'Exports wavelength and intensity data as CSV with metadata header.',
    snapshotDescription: (count) => ` Includes ${count} snapshot column${count > 1 ? 's' : ''}.`,
    supportsSnapshots: true,
    icon: 'document',
  },
  {
    key: 'svg',
    label: 'SVG',
    subtitle: 'Vector Diagram',
    description: 'Exports the CIE chromaticity diagram as a standalone SVG file with embedded styles.',
    snapshotDescription: () => '',
    supportsSnapshots: false,
    icon: 'image',
  },
  {
    key: 'png',
    label: 'PNG',
    subtitle: 'Raster Image',
    description: 'High-resolution image for reports and papers (2x scale).',
    snapshotDescription: () => '',
    supportsSnapshots: false,
    icon: 'photo',
  },
  {
    key: 'json',
    label: 'JSON',
    subtitle: 'Session Data',
    description: 'Full session data, can be re-imported later.',
    snapshotDescription: (count) => ` Includes ${count} snapshot${count > 1 ? 's' : ''}.`,
    supportsSnapshots: true,
    icon: 'code',
  },
];

/** SVG icons for each format type */
function FormatIcon({ type, className }: { type: string; className: string }) {
  switch (type) {
    case 'document':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
    case 'image':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      );
    case 'photo':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      );
    case 'code':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
        </svg>
      );
    default:
      return null;
  }
}

export function ExportModal({
  isOpen,
  onClose,
  onExport,
  snapshotCount,
  theme = 'dark',
}: ExportModalProps) {
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [includeSnapshots, setIncludeSnapshots] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      // For PNG, the export is async; for others, use requestAnimationFrame
      if (format === 'png') {
        await onExport(format, includeSnapshots);
      } else {
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => {
            onExport(format, includeSnapshots);
            resolve();
          });
        });
      }
    } finally {
      setIsExporting(false);
      onClose();
    }
  }, [format, includeSnapshots, onExport, onClose]);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);

  if (!isOpen) return null;

  // Find the current format option
  const currentFormat = FORMAT_OPTIONS.find((f) => f.key === format)!;
  const showSnapshotCheckbox = currentFormat.supportsSnapshots;

  // Theme classes
  const modalBg = theme === 'dark' ? 'bg-gray-800' : 'bg-white';
  const textColor = theme === 'dark' ? 'text-gray-100' : 'text-gray-900';
  const mutedColor = theme === 'dark' ? 'text-gray-400' : 'text-gray-600';
  const borderColor = theme === 'dark' ? 'border-gray-700' : 'border-gray-300';
  const inputBg = theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50';
  const hoverBg = theme === 'dark' ? 'hover:bg-gray-700/50' : 'hover:bg-gray-100';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div
        className={`${modalBg} rounded-xl shadow-2xl w-full max-w-md border ${borderColor} animate-in fade-in zoom-in-95`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-modal-title"
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b ${borderColor}`}>
          <h2 id="export-modal-title" className={`text-base font-semibold ${textColor}`}>
            Export Data
          </h2>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors ${mutedColor} ${hoverBg}`}
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Format Selection - 2x2 grid */}
          <div>
            <label className={`block text-xs font-medium mb-2 uppercase tracking-wider ${mutedColor}`}>
              Format
            </label>
            <div className="grid grid-cols-2 gap-2">
              {FORMAT_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setFormat(opt.key)}
                  className={`relative flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all ${
                    format === opt.key
                      ? 'border-blue-500 bg-blue-500/10'
                      : `${borderColor} border ${inputBg} ${hoverBg}`
                  }`}
                >
                  <FormatIcon
                    type={opt.icon}
                    className={`w-6 h-6 ${format === opt.key ? 'text-blue-400' : mutedColor}`}
                  />
                  <span className={`text-xs font-medium ${format === opt.key ? 'text-blue-400' : textColor}`}>
                    {opt.label}
                  </span>
                  <span className={`text-[10px] ${mutedColor}`}>{opt.subtitle}</span>
                  {format === opt.key && (
                    <div className="absolute top-1.5 right-1.5 w-2 h-2 bg-blue-500 rounded-full" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Include Snapshots (CSV and JSON only) */}
          {showSnapshotCheckbox && (
            <label
              className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${inputBg} border ${borderColor} ${hoverBg}`}
            >
              <input
                type="checkbox"
                checked={includeSnapshots}
                onChange={(e) => setIncludeSnapshots(e.target.checked)}
                disabled={snapshotCount === 0}
                className={`w-4 h-4 rounded text-blue-500 focus:ring-blue-500 focus:ring-offset-0 ${
                  theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'
                }`}
              />
              <div className="flex-1">
                <span className={`text-sm ${snapshotCount === 0 ? mutedColor : textColor}`}>
                  Include Snapshots
                </span>
                <p className={`text-[10px] mt-0.5 ${mutedColor}`}>
                  {snapshotCount > 0
                    ? `${snapshotCount} snapshot${snapshotCount > 1 ? 's' : ''} available`
                    : 'No snapshots saved'}
                </p>
              </div>
            </label>
          )}

          {/* Format Description */}
          <div className={`p-3 rounded-lg ${inputBg} border ${borderColor}`}>
            <p className={`text-[11px] ${mutedColor}`}>
              {currentFormat.description}
              {showSnapshotCheckbox && includeSnapshots && snapshotCount > 0
                ? currentFormat.snapshotDescription(snapshotCount)
                : ''}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className={`flex items-center justify-end gap-2 px-5 py-3 border-t ${borderColor}`}>
          <button
            onClick={onClose}
            className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors ${
              theme === 'dark'
                ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
            }`}
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors ${
              isExporting
                ? 'bg-blue-600/50 text-white/50 cursor-wait'
                : 'bg-blue-600 hover:bg-blue-500 text-white'
            }`}
          >
            {isExporting ? 'Exporting...' : 'Export'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ExportModal;
