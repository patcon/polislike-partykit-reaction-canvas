import type React from 'react';
import { PLUGINS } from '../plugins/index';

export const SOLO_SCREEN_LABEL = 'Canvas';

export interface PanelMeta {
  id: string;
  type: 'screen' | 'panel';
  label: string;
  shortLabel?: string;
  description: string;
  canStandalone: boolean;
  canScreenMount: boolean;
  /** True if the panel requires a secure context (HTTPS/localhost). Shown as a warning in the Interfaces tab on HTTP. */
  requiresHttps?: boolean;
}

export const PANEL_REGISTRY: PanelMeta[] = [
  { id: 'emcee',        type: 'panel',  label: 'Emcee',           description: 'Event host controls and tools',  canStandalone: true,  canScreenMount: false },
  { id: 'canvas',       type: 'screen', label: 'Reaction Canvas', description: 'Standard reaction canvas',       canStandalone: false, canScreenMount: true  },
  ...PLUGINS,
];

export const STANDALONE_PANELS = PANEL_REGISTRY.filter(p => p.canStandalone);

/**
 * A fully registered panel: metadata + a prop-free component.
 * All dependencies are provided via PanelContext and plugin-owned contexts
 * (e.g. plugins/socialSharing/context.ts, plugins/imageCanvas/context.ts).
 */
export interface PanelDefinition extends PanelMeta {
  component: React.ComponentType;
}
