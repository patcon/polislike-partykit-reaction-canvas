import type { PanelPlugin } from '../types';
import TreevitesComponent from './component';

const treevitesPlugin: PanelPlugin = {
  id: 'treevites',
  label: 'Leaderboard',
  description: 'Invite stats — who invited whom',
  patchable: true,
  activityMode: true,
  component: TreevitesComponent,
};

export default treevitesPlugin;
