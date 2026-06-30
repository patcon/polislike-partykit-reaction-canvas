import type { PanelPlugin } from '../types';
import { GreeterServerPlugin } from './server';
import type { GreeterPluginState } from './types';
import GreeterComponent from './component';
import GreeterConfigModal from './configModal';

const greeterPlugin: PanelPlugin<GreeterPluginState> = {
  id: 'greeter',
  label: 'Greeter',
  description: 'Guild event attendee welcome list',
  canStandalone: true,
  canScreenMount: true,
  component: GreeterComponent,
  configModal: GreeterConfigModal,
  server: GreeterServerPlugin,
};

export default greeterPlugin;
