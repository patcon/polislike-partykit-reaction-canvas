import type { PanelPlugin } from '../types';
import { mapServer } from './server';
import MapMakerPanel from './mapMaker';
import MapViewerPanel from './mapViewer';
import MapViewerConfigModal from './MapViewerConfigModal';

const mapMakerPlugin: PanelPlugin = {
  id: 'map-maker',
  type: 'panel',
  label: 'Map Maker',
  shortLabel: 'Map Maker',
  description: 'Compute UMAP/PaCMAP/LocalMAP projection from captured moments',
  canStandalone: true,
  canScreenMount: true,
  component: MapMakerPanel,
  server: mapServer,
};

const mapViewerPlugin: PanelPlugin = {
  id: 'map-viewer',
  type: 'panel',
  label: 'Map Viewer',
  shortLabel: 'Map Viewer',
  description: 'View the computed participant map',
  canStandalone: true,
  canScreenMount: true,
  component: MapViewerPanel,
  configModal: MapViewerConfigModal,
};

export default [mapMakerPlugin, mapViewerPlugin] as PanelPlugin[];
