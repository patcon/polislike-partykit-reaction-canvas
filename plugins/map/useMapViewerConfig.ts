import { useState, useEffect, useCallback } from 'react';
import type { MapViewerConfig } from '../../app/types';

const STORAGE_KEY = 'map-viewer-config';
const EVENT = 'map-viewer-config-changed';

export function useMapViewerConfig(): { config: MapViewerConfig | null; setConfig: (cfg: MapViewerConfig | null) => void } {
  const [config, setConfigState] = useState<MapViewerConfig | null>(
    () => JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'),
  );

  useEffect(() => {
    const handler = (e: Event) => setConfigState((e as CustomEvent<MapViewerConfig | null>).detail);
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
  }, []);

  const setConfig = useCallback((cfg: MapViewerConfig | null) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
    window.dispatchEvent(new CustomEvent<MapViewerConfig | null>(EVENT, { detail: cfg }));
  }, []);

  return { config, setConfig };
}
