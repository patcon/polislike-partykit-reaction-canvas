import type { PanelPlugin } from '../types';
import { lightServer, type LightState } from './server';
import ScreenLight from './ScreenLight';
import LightShow from './LightShow';

const screenLightPlugin: PanelPlugin<LightState> = {
  id: 'screen-light',
  type: 'panel',
  label: 'Screen Light',
  shortLabel: 'Light',
  description: 'Full-screen colored light controlled remotely',
  canStandalone: false,
  canScreenMount: true,
  requiresHttps: true,
  component: ScreenLight,
  server: lightServer,
};

const lightShowPlugin: PanelPlugin = {
  id: 'light-show',
  type: 'panel',
  label: 'Light Show',
  shortLabel: 'LShow',
  description: 'Control the screen-light color on all connected phones',
  canStandalone: true,
  canScreenMount: false,
  component: LightShow,
};

export default [screenLightPlugin, lightShowPlugin] as PanelPlugin[];
