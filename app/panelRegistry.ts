import type React from 'react';
import { PLUGINS } from '../plugins/index';

export const SOLO_SCREEN_LABEL = 'Canvas';

export interface PanelMeta {
  id: string;
  label: string;
  shortLabel?: string;
  description: string;
  patchable: boolean;
  activityMode: boolean;
  /** True if the panel requires a secure context (HTTPS/localhost). Shown as a warning in the Interfaces tab on HTTP. */
  requiresHttps?: boolean;
}

export const PANEL_REGISTRY: PanelMeta[] = [
  { id: 'emcee',        label: 'Emcee',           description: 'Event host controls and tools',                         patchable: true,  activityMode: false },
  { id: 'canvas',       label: 'Reaction Canvas', description: 'Standard reaction canvas',                              patchable: false, activityMode: true  },
  ...PLUGINS,
];

export const PATCHABLE_PANELS = PANEL_REGISTRY.filter(p => p.patchable);

/**
 * A fully registered panel: metadata + a prop-free component.
 * All dependencies are provided via PanelContext and the panel-specific
 * config contexts in app/context/PanelConfigs.tsx.
 */
export interface PanelDefinition extends PanelMeta {
  component: React.ComponentType;
}
