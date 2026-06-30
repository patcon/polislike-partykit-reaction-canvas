import type { PanelPlugin } from '../types';
import ValenceBeatPadComponent from './component';

const valenceBeatPadPlugin: PanelPlugin = {
  id: 'valence-beat-pad',
  label: 'Valence Beat Pad',
  shortLabel: 'Beat Pad',
  description: 'Interactive musical pad driven by audience valence',
  canStandalone: true,
  canScreenMount: true,
  component: ValenceBeatPadComponent,
};

export default valenceBeatPadPlugin;
