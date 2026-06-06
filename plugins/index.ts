import type { PanelPlugin } from './types';
import imageCanvasPlugin from './imageCanvas/index';
import soccerPlugin from './soccer/index';
import greeterPlugin from './greeter/index';
// import helloWorldPlugin from './helloWorld/index';  // uncomment to activate the helloWorld example plugin

export const PLUGINS: PanelPlugin[] = [
  imageCanvasPlugin,
  soccerPlugin,
  greeterPlugin,
  // helloWorldPlugin,
];

export const PLUGIN_MAP: Record<string, PanelPlugin> = Object.fromEntries(
  PLUGINS.map(p => [p.id, p]),
);
