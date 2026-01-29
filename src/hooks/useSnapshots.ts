/**
 * useSnapshots Hook
 *
 * Manages snapshot state for color coordinate comparison
 * Provides save, restore, and delete functionality
 */

import { useState, useCallback, useMemo } from 'react';
import type { Snapshot, ChromaticityResult } from '../types/spectrum';

const MAX_SNAPSHOTS = 10;
const STORAGE_KEY = 'spectrum-visualizer-snapshots';

interface UseSnapshotsOptions {
  maxSnapshots?: number;
  persistToStorage?: boolean;
}

interface UseSnapshotsReturn {
  snapshots: Snapshot[];
  addSnapshot: (shiftNm: number, chromaticity: ChromaticityResult, label?: string) => Snapshot | null;
  removeSnapshot: (id: string) => void;
  clearSnapshots: () => void;
  updateSnapshotLabel: (id: string, label: string) => void;
  getSnapshot: (id: string) => Snapshot | undefined;
  canAddMore: boolean;
}

function generateId(): string {
  return `snap-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function loadFromStorage(): Snapshot[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn('Failed to load snapshots from storage:', e);
  }
  return [];
}

function saveToStorage(snapshots: Snapshot[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshots));
  } catch (e) {
    console.warn('Failed to save snapshots to storage:', e);
  }
}

export function useSnapshots(options: UseSnapshotsOptions = {}): UseSnapshotsReturn {
  const { maxSnapshots = MAX_SNAPSHOTS, persistToStorage = true } = options;

  const [snapshots, setSnapshots] = useState<Snapshot[]>(() => {
    if (persistToStorage) {
      return loadFromStorage();
    }
    return [];
  });

  // Check if we can add more snapshots
  const canAddMore = useMemo(() => snapshots.length < maxSnapshots, [snapshots.length, maxSnapshots]);

  // Add a new snapshot
  const addSnapshot = useCallback(
    (shiftNm: number, chromaticity: ChromaticityResult, label?: string): Snapshot | null => {
      if (snapshots.length >= maxSnapshots) {
        console.warn(`Maximum snapshots (${maxSnapshots}) reached`);
        return null;
      }

      const newSnapshot: Snapshot = {
        id: generateId(),
        timestamp: Date.now(),
        shiftNm,
        chromaticity,
        label,
      };

      setSnapshots((prev) => {
        const updated = [...prev, newSnapshot];
        if (persistToStorage) {
          saveToStorage(updated);
        }
        return updated;
      });

      return newSnapshot;
    },
    [snapshots.length, maxSnapshots, persistToStorage]
  );

  // Remove a snapshot by ID
  const removeSnapshot = useCallback(
    (id: string) => {
      setSnapshots((prev) => {
        const updated = prev.filter((s) => s.id !== id);
        if (persistToStorage) {
          saveToStorage(updated);
        }
        return updated;
      });
    },
    [persistToStorage]
  );

  // Clear all snapshots
  const clearSnapshots = useCallback(() => {
    setSnapshots([]);
    if (persistToStorage) {
      saveToStorage([]);
    }
  }, [persistToStorage]);

  // Update snapshot label
  const updateSnapshotLabel = useCallback(
    (id: string, label: string) => {
      setSnapshots((prev) => {
        const updated = prev.map((s) => (s.id === id ? { ...s, label } : s));
        if (persistToStorage) {
          saveToStorage(updated);
        }
        return updated;
      });
    },
    [persistToStorage]
  );

  // Get a specific snapshot
  const getSnapshot = useCallback(
    (id: string): Snapshot | undefined => {
      return snapshots.find((s) => s.id === id);
    },
    [snapshots]
  );

  return {
    snapshots,
    addSnapshot,
    removeSnapshot,
    clearSnapshots,
    updateSnapshotLabel,
    getSnapshot,
    canAddMore,
  };
}

export default useSnapshots;
