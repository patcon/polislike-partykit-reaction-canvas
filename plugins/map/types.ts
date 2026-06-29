import type { MapProjection, MapViewerConfig } from '../../app/types';

export interface MapPluginState {
  projection: MapProjection | null;
  viewerConfig: MapViewerConfig | null;
}
