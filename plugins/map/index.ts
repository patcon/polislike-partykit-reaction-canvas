import type { PanelPlugin } from '../types';
import { mapServer } from './server';
import MapMakerPanel from './mapMaker';
import MapViewerPanel from './mapViewer';
import MapViewerConfigModal from './MapViewerConfigModal';

const mapMakerPlugin: PanelPlugin = {
  id: 'map-maker',
  label: 'Map Maker',
  shortLabel: 'Map Maker',
  description: 'Compute UMAP/PaCMAP/LocalMAP projection from captured moments',
  patchable: true,
  activityMode: true,
  component: MapMakerPanel,
  server: mapServer,
};

const mapViewerPlugin: PanelPlugin = {
  id: 'map-viewer',
  label: 'Map Viewer',
  shortLabel: 'Map Viewer',
  description: 'View the computed participant map',
  patchable: true,
  activityMode: true,
  component: MapViewerPanel,
  configModal: MapViewerConfigModal,
};

export default [mapMakerPlugin, mapViewerPlugin] as PanelPlugin[];
