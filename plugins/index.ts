import type { PanelPlugin } from './types';
import soccerPlugin from './soccer/index';
import greeterPlugin from './greeter/index';

export const PLUGINS: PanelPlugin[] = [soccerPlugin, greeterPlugin];

export const PLUGIN_MAP: Record<string, PanelPlugin> = Object.fromEntries(
  PLUGINS.map(p => [p.id, p]),
);
