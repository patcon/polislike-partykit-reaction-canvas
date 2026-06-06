import type { PanelPlugin } from '../types';
import { mapServer } from './server';
import MapMakerPanel from '../../app/components/panels/MapMakerPanel';
import MapViewerPanel from '../../app/components/panels/MapViewerPanel';
import MapViewerConfigModal from './MapViewerConfigModal';

const mapMakerPlugin: PanelPlugin = {
  id: 'map-maker',
  label: 'Map Maker',
  shortLabel: 'Map',
  description: 'Compute UMAP/PaCMAP/LocalMAP projection from captured moments',
  patchable: false,
  activityMode: false,
  component: MapMakerPanel,
  server: mapServer,
};

const mapViewerPlugin: PanelPlugin = {
  id: 'map-viewer',
  label: 'Map Viewer',
  shortLabel: 'Map',
  description: 'View the computed participant map',
  patchable: true,
  activityMode: true,
  component: MapViewerPanel,
  configModal: MapViewerConfigModal,
  server: mapServer,
};

export default [mapMakerPlugin, mapViewerPlugin] as PanelPlugin[];
