import type { PanelPlugin } from './types';
import imageCanvasPlugin from './imageCanvas/index';
import soccerPlugin from './soccer/index';
import greeterPlugin from './greeter/index';
import lightPlugins from './light/index';
import mapPlugins from './map/index';
import socialSharingPlugin from './socialSharing/index';
import arrivalCanvasPlugin from './arrivalCanvas/index';
import moodTonesPlugin from './moodTones/index';
import treevitesPlugin from './treevites/index';
import valenceBeatPadPlugin from './valenceBeatPad/index';
import signatureCanvasPlugin from './signatureCanvas/index';
import { neighborPlugin } from './neighbor/index';
import narrativePlugins from './narrative/index';
// import helloWorldPlugin from './helloWorld/index';  // uncomment to activate the helloWorld example plugin

type PluginExport = PanelPlugin | PanelPlugin[];

const pluginExports: PluginExport[] = [
  imageCanvasPlugin,
  soccerPlugin,
  greeterPlugin,
  lightPlugins,
  mapPlugins,
  socialSharingPlugin,
  arrivalCanvasPlugin,
  moodTonesPlugin,
  treevitesPlugin,
  valenceBeatPadPlugin,
  signatureCanvasPlugin,
  neighborPlugin,
  narrativePlugins,
  // helloWorldPlugin,
];

export const PLUGINS: PanelPlugin[] = pluginExports.flat();

export const PLUGIN_MAP: Record<string, PanelPlugin> = Object.fromEntries(
  PLUGINS.map(p => [p.id, p]),
);
