import type { PanelPlugin } from '../types';
import ValenceCrossSectionPanel from './component';

const valenceCrossSectionPlugin: PanelPlugin = {
  id: 'valenceCrossSection',
  label: 'Valence Cross-Section',
  description: 'Live audience valence rendered as chords across four geometries',
  canStandalone: true,
  canScreenMount: true,
  component: ValenceCrossSectionPanel,
};

export default valenceCrossSectionPlugin;
