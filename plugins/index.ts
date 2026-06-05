import type { PanelPlugin } from './types';
import soccerPlugin from './soccer/index';

export const PLUGINS: PanelPlugin[] = [soccerPlugin];

export const PLUGIN_MAP: Record<string, PanelPlugin> = Object.fromEntries(
  PLUGINS.map(p => [p.id, p]),
);
