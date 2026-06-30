import type React from 'react';
import type * as Party from 'partykit/server';

/** Minimal connection abstraction — avoids coupling plugins to partykit internals. */
export interface PluginConnection {
  id: string;
  /** Persistent user UUID (from ?userId= query param, falls back to conn.id). */
  userId: string;
  send(msg: string): void;
}

/**
 * Server-provided services passed to every plugin lifecycle call.
 * Keeps the ServerPlugin interface stable while letting plugins access shared server state.
 */
export interface PluginContext {
  broadcast: (msg: string) => void;
  /** Send a message to all connections belonging to a specific userId. */
  sendToUser: (userId: string, msg: string) => void;
  getCursorPositions: () => Map<string, { x: number; y: number }>;
  /** Signal that plugin state has changed and should be durably persisted. */
  persistState: () => Promise<void>;
}

/** Server-side lifecycle handlers. S = plugin-owned state. */
export interface ServerPlugin<S> {
  /** Return initial server-side state for this plugin. Called once on room start. */
  createState(): S;
  /** Called when a client connects. Use conn.send() to push current state to the new client. */
  onConnect(conn: PluginConnection, ctx: PluginContext, state: S, currentScreenPanel: string): void;
  /**
   * Called before the main server switch for every incoming message.
   * Return true if handled (stops further processing), false to fall through.
   */
  onMessage(
    type: string,
    payload: unknown,
    conn: PluginConnection,
    ctx: PluginContext,
    state: S,
    currentScreenPanel: string,
  ): boolean;
  /** Called when this plugin's activity ID becomes the active activity. */
  onActivate(ctx: PluginContext, state: S): void;
  /** Called when another activity replaces this plugin's activity. */
  onDeactivate(ctx: PluginContext, state: S): void;
  /** Called when a client disconnects. Use for per-user cleanup (e.g. removing codes when last connection drops). */
  onClose?(conn: PluginConnection, ctx: PluginContext, state: S): void;
  /**
   * Called by the main server's onRequest for every HTTP request to the room.
   * Return a Response to handle it; return null to fall through to the main handler.
   */
  onRequest?(request: Party.Request, ctx: PluginContext, state: S): Promise<Response | null> | Response | null;
  /**
   * Return the portion of plugin state to persist. Called by the server before writing storage.
   * Use a wrapper object (e.g. `{ config: S }`) so state is always an object reference.
   */
  getPersistedState?(state: S): unknown;
  /**
   * Restore previously persisted state into the live state object.
   * Mutate `state` in-place rather than replacing the reference.
   */
  applyPersistedState?(state: S, saved: unknown): void;
}

/** Configuration for canvas-mode activities that overlay the main canvas rather than replacing it. */
export interface CanvasOverlay {
  /** Rendered absolutely inside the canvas container behind the touch layer (e.g. a background image). */
  background?: React.ComponentType;
  /** Overrides forwarded to the <Canvas> component when this activity is active. */
  canvasProps?: {
    disableCursorValence?: boolean;
    disableBackgroundValence?: boolean;
  };
}

/**
 * A fully self-contained panel plugin: metadata, optional client UI, and optional server logic.
 * Designed so future panels can be distributed as npm packages that export a PanelPlugin.
 *
 * A plugin is either panel-mode (component replaces the canvas view) or canvas-mode
 * (canvasOverlay configures the canvas). Providing both is not supported.
 */
export interface PanelPlugin<S = unknown> {
  id: string;
  label: string;
  shortLabel?: string;
  description: string;
  canStandalone: boolean;
  canScreenMount: boolean;
  /** Requires server lifecycle activation (onActivate). Can only mount on a lifecycle screen. */
  needsLifecycle?: boolean;
  /** Panel-mode: React component rendered in the chip bar / activity overlay. */
  component?: React.ComponentType;
  /** Canvas-mode: configures the always-mounted canvas container instead of replacing it. */
  canvasOverlay?: CanvasOverlay;
  /** Config modal opened from the InterfacesTab settings button. Receives only onClose; reads state via useAdminSocket(). */
  configModal?: React.ComponentType<{ onClose: () => void }>;
  /** Server-side handlers. Omit for purely client-side panels. */
  server?: ServerPlugin<S>;
  /** True if the panel requires a secure context (HTTPS/localhost). Shown as a warning in the Interfaces tab on HTTP. */
  requiresHttps?: boolean;
}
