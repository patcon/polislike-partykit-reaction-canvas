import type { PanelPlugin } from '../../types';
import type { StenoState } from '../types';
import StenoPanel from './component';
import { stenoServer } from './server';

export const stenoPlugin: PanelPlugin<StenoState> = {
  id: 'steno',
  label: 'Steno',
  description: 'Live shared speech-to-text transcript',
  patchable: true,
  activityMode: true,
  requiresHttps: true,
  component: StenoPanel,
  server: stenoServer,
};
