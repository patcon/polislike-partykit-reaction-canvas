import type { PanelPlugin } from '../types';
import ParticleFieldPanel from './component';

const particleFieldPlugin: PanelPlugin = {
  id: 'particleField',
  label: 'Particle Field Test',
  description: 'Particles cluster and repel based on live participant cursor proximity',
  canStandalone: true,
  canScreenMount: true,
  component: ParticleFieldPanel,
};

export default particleFieldPlugin;
