import type React from 'react';

/** Minimal connection abstraction — avoids coupling plugins to partykit internals. */
export interface PluginConnection {
  id: string;
  send(msg: string): void;
}

/** Server-side lifecycle handlers. S = plugin-owned state. */
export interface ServerPlugin<S> {
  /** Return initial server-side state for this plugin. Called once on room start. */
  createState(): S;
  /** Called when a client connects. Use conn.send() to push current state to the new client. */
  onConnect(
    conn: PluginConnection,
    broadcast: (msg: string) => void,
    state: S,
    currentActivity: string,
  ): void;
  /**
   * Called before the main server switch for every incoming message.
   * Return true if handled (stops further processing), false to fall through.
   */
  onMessage(
    type: string,
    payload: unknown,
    conn: PluginConnection,
    broadcast: (msg: string) => void,
    state: S,
    currentActivity: string,
  ): boolean;
  /** Called when this plugin's activity ID becomes the active activity. */
  onActivate(broadcast: (msg: string) => void, state: S): void;
  /** Called when another activity replaces this plugin's activity. */
  onDeactivate(broadcast: (msg: string) => void, state: S): void;
}

/**
 * A fully self-contained panel plugin: metadata, optional client UI, and optional server logic.
 * Designed so future panels can be distributed as npm packages that export a PanelPlugin.
 */
export interface PanelPlugin<S = unknown> {
  id: string;
  label: string;
  shortLabel?: string;
  description: string;
  patchable: boolean;
  activityMode: boolean;
  /** React component rendered in the chip bar / activity overlay. Omit for canvas-based activities. */
  component?: React.ComponentType;
  /** Config modal opened from the InterfacesTab settings button. */
  configModal?: React.ComponentType;
  /** Server-side handlers. Omit for purely client-side panels. */
  server?: ServerPlugin<S>;
}
