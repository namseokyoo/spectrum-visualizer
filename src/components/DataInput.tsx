import { useState, useCallback, useRef, type DragEvent, type ChangeEvent } from 'react';
import { parseSpectrumFile } from '../lib/file-parser';
import { parseAndValidateClipboard, getExampleFormat, createSampleData } from '../lib/clipboard-parser';
import { normalizeSpectrum } from '../lib/normalize';
import { interpolateToVisibleRange } from '../lib/interpolate';
import { PRESETS, type PresetKey } from '../lib/presets';
import type { SpectrumPoint } from '../types/spectrum';

interface DataInputProps {
  onDataLoaded: (data: SpectrumPoint[]) => void;
}

export function DataInput({ onDataLoaded }: DataInputProps) {
  const [activeTab, setActiveTab] = useState<'file' | 'paste' | 'preset'>('preset');
  const [pasteText, setPasteText] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processData = useCallback((rawData: SpectrumPoint[]) => {
    // Normalize and interpolate
    const normalized = normalizeSpectrum(rawData);
    const interpolated = interpolateToVisibleRange(normalized);
    return interpolated;
  }, []);

  // Handle file upload
  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const file = files[0];
    const validExtensions = ['.csv', '.txt', '.tsv'];
    const extension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));

    if (!validExtensions.includes(extension)) {
      setError('Please upload a CSV, TXT, or TSV file');
      return;
    }

    setIsLoading(true);
    setError(null);
    setWarnings([]);

    try {
      const data = await parseSpectrumFile(file);

      if (data.length === 0) {
        setError('No valid data found in file');
        return;
      }

      const processed = processData(data);
      onDataLoaded(processed);
    } catch (err) {
      setError(`Failed to parse file: ${err}`);
    } finally {
      setIsLoading(false);
    }
  }, [onDataLoaded, processData]);

  // Handle drag and drop
  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  }, [handleFileSelect]);

  // Handle paste text input
  const handlePasteApply = useCallback(() => {
    if (!pasteText.trim()) {
      setError('Please paste some data first');
      return;
    }

    setIsLoading(true);
    setError(null);
    setWarnings([]);

    const result = parseAndValidateClipboard(pasteText);

    if (!result.valid) {
      setError(result.errors.join(', '));
      setIsLoading(false);
      return;
    }

    if (result.warnings.length > 0) {
      setWarnings(result.warnings);
    }

    const processed = processData(result.data);
    onDataLoaded(processed);
    setIsLoading(false);
  }, [pasteText, onDataLoaded, processData]);

  // Handle preset selection
  const handlePresetSelect = useCallback((presetKey: PresetKey) => {
    const presetData = PRESETS[presetKey].data;
    onDataLoaded([...presetData]);
    setError(null);
    setWarnings([]);
  }, [onDataLoaded]);

  // Load sample data
  const handleLoadSample = useCallback(() => {
    const sampleText = createSampleData();
    setPasteText(sampleText);
  }, []);

  return (
    <div className="w-full">
      {/* Tab Navigation */}
      <div className="flex bg-gray-900/50 rounded-lg p-0.5 mb-3 border border-gray-700/30">
        <button
          onClick={() => setActiveTab('preset')}
          className={`flex-1 px-2 py-1.5 text-[10px] font-medium rounded-md transition-all ${
            activeTab === 'preset'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
          }`}
        >
          Presets
        </button>
        <button
          onClick={() => setActiveTab('file')}
          className={`flex-1 px-2 py-1.5 text-[10px] font-medium rounded-md transition-all ${
            activeTab === 'file'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
          }`}
        >
          File
        </button>
        <button
          onClick={() => setActiveTab('paste')}
          className={`flex-1 px-2 py-1.5 text-[10px] font-medium rounded-md transition-all ${
            activeTab === 'paste'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
          }`}
        >
          Paste
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-3 p-2 bg-red-900/20 border border-red-700/50 rounded-lg text-red-400 text-[10px]">
          {error}
        </div>
      )}

      {/* Warnings Display */}
      {warnings.length > 0 && (
        <div className="mb-3 p-2 bg-yellow-900/20 border border-yellow-700/50 rounded-lg text-yellow-400 text-[10px]">
          <ul className="list-disc list-inside">
            {warnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Preset Tab */}
      {activeTab === 'preset' && (
        <div className="space-y-2">
          <p className="text-[10px] text-gray-500 mb-2">
            Select a preset emission spectrum:
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {Object.entries(PRESETS).map(([key, preset]) => (
              <button
                key={key}
                onClick={() => handlePresetSelect(key as PresetKey)}
                className="px-2 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-md text-[11px] text-gray-300 transition-colors text-left border border-gray-700/50 hover:border-gray-600"
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* File Upload Tab */}
      {activeTab === 'file' && (
        <div>
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border border-dashed rounded-lg p-4 text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-blue-500 bg-blue-900/20'
                : 'border-gray-600 hover:border-gray-500 bg-gray-800/30'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt,.tsv"
              onChange={(e: ChangeEvent<HTMLInputElement>) => handleFileSelect(e.target.files)}
              className="hidden"
            />
            <div className="text-gray-400">
              {isLoading ? (
                <span className="text-xs">Loading...</span>
              ) : (
                <>
                  <p className="text-xs mb-1">Drag & drop a file</p>
                  <p className="text-[10px] text-gray-500">or click to browse</p>
                  <p className="text-[9px] mt-2 text-gray-600">
                    CSV, TXT, TSV
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Paste Tab */}
      {activeTab === 'paste' && (
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <p className="text-[10px] text-gray-500">
              Wavelength/intensity data:
            </p>
            <button
              onClick={handleLoadSample}
              className="text-[10px] text-blue-400 hover:text-blue-300"
            >
              Load sample
            </button>
          </div>
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder={getExampleFormat()}
            className="w-full h-28 p-2 bg-gray-800/50 border border-gray-700/50 rounded-lg text-[10px] text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500/50 font-mono resize-none"
          />
          <button
            onClick={handlePasteApply}
            disabled={isLoading || !pasteText.trim()}
            className="w-full py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-md text-xs font-medium transition-colors"
          >
            {isLoading ? 'Processing...' : 'Apply Data'}
          </button>
        </div>
      )}
    </div>
  );
}
