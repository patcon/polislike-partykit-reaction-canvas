import type { PanelPlugin } from '../types';
import { SoccerServerPlugin } from './server';
import SoccerConfigModal from './component';

const soccerPlugin: PanelPlugin = {
  id: 'soccer',
  label: 'Soccer',
  description: 'Top-down physics ball — kick with your cursor',
  canStandalone: false,
  canScreenMount: true,
  configModal: SoccerConfigModal,
  server: SoccerServerPlugin,
};

export default soccerPlugin;
