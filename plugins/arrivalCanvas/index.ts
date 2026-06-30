import type { PanelPlugin } from '../types';
import { ArrivalCanvasServerPlugin } from './server';
import type { ArrivalCanvasPluginState } from './types';
import ArrivalCanvasComponent from './component';
import ArrivalCanvasConfigModal from './configModal';

const arrivalCanvasPlugin: PanelPlugin<ArrivalCanvasPluginState> = {
  id: 'arrival-canvas',
  label: 'Arrival Canvas',
  shortLabel: 'Arrival',
  description: 'Room-fill visualizer with THX-style audio convergence',
  canStandalone: true,
  canScreenMount: true,
  component: ArrivalCanvasComponent,
  configModal: ArrivalCanvasConfigModal,
  server: ArrivalCanvasServerPlugin,
};

export default arrivalCanvasPlugin;
