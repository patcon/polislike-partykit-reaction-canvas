import type { PanelPlugin } from '../types';
import type { NeighborState } from './types';
import { NeighborServerPlugin } from './server';
import NeighborPanel from './component';

export const neighborPlugin: PanelPlugin<NeighborState> = {
  id: 'neighbor',
  label: 'Neighbor Network',
  shortLabel: 'Neighbor',
  description: 'Social graph of nearby audience members',
  canStandalone: true,
  canScreenMount: true,
  component: NeighborPanel,
  server: NeighborServerPlugin,
};
