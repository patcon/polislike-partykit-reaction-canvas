import type { PanelPlugin } from '../types';
import BoidsPanel from './component';

const boidsPlugin: PanelPlugin = {
  id: 'boids',
  label: 'Boids',
  description: 'Autonomous boids swarm driven by live participant cursors',
  canStandalone: true,
  canScreenMount: true,
  component: BoidsPanel,
};

export default boidsPlugin;
