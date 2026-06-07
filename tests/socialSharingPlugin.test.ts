import { describe, it, expect, vi } from 'vitest';
import { SocialSharingServerPlugin } from '../plugins/socialSharing/server';
import type { PluginConnection, PluginContext } from '../plugins/types';
import type { SocialConfig } from '../app/types';

function makeCtx(): PluginContext {
  return {
    broadcast: vi.fn(),
    getCursorPositions: () => new Map(),
    persistState: vi.fn().mockResolvedValue(undefined),
  };
}

function makeConn(id = 'conn-1'): PluginConnection {
  return { id, send: vi.fn() };
}

const sampleConfig: SocialConfig = {
  default: 'hello #event',
  twitter: '@me',
  bluesky: '@me.bsky',
  mastodon: '@me@instance',
  instagram: '@me',
};

describe('SocialSharingServerPlugin', () => {
  it('createState returns null config', () => {
    expect(SocialSharingServerPlugin.createState()).toEqual({ config: null });
  });

  it('onConnect pushes current config to the new connection', () => {
    const state = SocialSharingServerPlugin.createState();
    state.config = sampleConfig;
    const conn = makeConn();
    SocialSharingServerPlugin.onConnect(conn, makeCtx(), state, 'social-sharing');
    expect(conn.send).toHaveBeenCalledOnce();
    const msg = JSON.parse((conn.send as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(msg).toEqual({ type: 'socialConfigChanged', config: sampleConfig });
  });

  it('onMessage stores config, broadcasts, persists, and returns true', () => {
    const state = SocialSharingServerPlugin.createState();
    const ctx = makeCtx();
    const handled = SocialSharingServerPlugin.onMessage(
      'setSocialConfig', { config: sampleConfig }, makeConn(), ctx, state, 'social-sharing',
    );
    expect(handled).toBe(true);
    expect(state.config).toEqual(sampleConfig);
    expect(ctx.broadcast).toHaveBeenCalledOnce();
    expect(JSON.parse((ctx.broadcast as ReturnType<typeof vi.fn>).mock.calls[0][0])).toEqual({
      type: 'socialConfigChanged', config: sampleConfig,
    });
    expect(ctx.persistState).toHaveBeenCalledOnce();
  });

  it('onMessage returns false for unrelated message types', () => {
    const state = SocialSharingServerPlugin.createState();
    const handled = SocialSharingServerPlugin.onMessage('move', {}, makeConn(), makeCtx(), state, 'canvas');
    expect(handled).toBe(false);
  });

  it('persist round-trips config', () => {
    const state = SocialSharingServerPlugin.createState();
    state.config = sampleConfig;
    const saved = SocialSharingServerPlugin.getPersistedState!(state);
    const restored = SocialSharingServerPlugin.createState();
    SocialSharingServerPlugin.applyPersistedState!(restored, saved);
    expect(restored.config).toEqual(sampleConfig);
  });
});
