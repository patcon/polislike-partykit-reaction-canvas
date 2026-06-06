import type { PanelPlugin } from '../types';
import HelloWorldPanel from './component';
import HelloWorldConfigModal from './configModal';
import { HelloWorldServerPlugin } from './server';
import type { HelloWorldPluginState } from './types';

const helloWorldPlugin: PanelPlugin<HelloWorldPluginState> = {
  id: 'helloWorld',
  label: 'Hello World',
  description: 'A minimal example panel — editable greeting message',
  patchable: true,
  activityMode: true,
  component: HelloWorldPanel,
  configModal: HelloWorldConfigModal,
  server: HelloWorldServerPlugin,
};

export default helloWorldPlugin;
