import type { PanelPlugin } from '../types';
import TreevitesComponent from './component';

const treevitesPlugin: PanelPlugin = {
  id: 'treevites',
  type: 'panel',
  label: 'Leaderboard',
  description: 'Invite stats — who invited whom',
  canStandalone: true,
  canScreenMount: true,
  component: TreevitesComponent,
};

export default treevitesPlugin;
