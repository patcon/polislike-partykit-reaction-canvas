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
  { id: 'steno',        label: 'Steno',           description: 'Live shared speech-to-text transcript',                 patchable: true,  activityMode: true,  requiresHttps: true },
  { id: 'story-tracer', label: 'Story Tracer',    description: 'Semantic 3D narrative path from VTT transcript',        patchable: true,  activityMode: true  },
  { id: 'voice-call',   label: 'Voice Calls',     description: 'Peer-to-peer voice calls via WebRTC',                   patchable: true,  activityMode: true,  requiresHttps: true },
  { id: 'neighbor',      label: 'Neighbor Network', shortLabel: 'Neighbor', description: 'Social graph of nearby audience members',             patchable: true,  activityMode: true  },
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
