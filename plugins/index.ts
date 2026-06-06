import type { PanelPlugin } from './types';
import imageCanvasPlugin from './imageCanvas/index';
import soccerPlugin from './soccer/index';
import greeterPlugin from './greeter/index';
import lightPlugins from './light/index';
import mapPlugins from './map/index';
// import helloWorldPlugin from './helloWorld/index';  // uncomment to activate the helloWorld example plugin

type PluginExport = PanelPlugin | PanelPlugin[];

const pluginExports: PluginExport[] = [
  imageCanvasPlugin,
  soccerPlugin,
  greeterPlugin,
  lightPlugins,
  mapPlugins,
  // helloWorldPlugin,
];

export const PLUGINS: PanelPlugin[] = pluginExports.flat();

export const PLUGIN_MAP: Record<string, PanelPlugin> = Object.fromEntries(
  PLUGINS.map(p => [p.id, p]),
);
