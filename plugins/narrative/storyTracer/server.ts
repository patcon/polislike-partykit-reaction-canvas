import type * as Party from 'partykit/server';
import type { ServerPlugin, PluginContext } from '../../types';
import type { StoryTracerState, StoryTracerPoint, StoryTracerMeta } from '../types';

export const storyTracerServer: ServerPlugin<StoryTracerState> = {
  createState: () => ({ points: null, meta: null }),

  onConnect(conn, _ctx, state) {
    conn.send(JSON.stringify({ type: 'storyTracerPointsChanged', points: state.points, meta: state.meta }));
  },

  onMessage(type, payload, _conn, ctx, state) {
    switch (type) {
      case 'storyTracerSetPoints': {
        const event = payload as { points: StoryTracerPoint[]; meta: StoryTracerMeta };
        state.points = event.points;
        state.meta = event.meta;
        void ctx.persistState();
        ctx.broadcast(JSON.stringify({ type: 'storyTracerPointsChanged', points: event.points, meta: event.meta }));
        return true;
      }
      case 'storyTracerClearPoints': {
        state.points = null;
        state.meta = null;
        void ctx.persistState();
        ctx.broadcast(JSON.stringify({ type: 'storyTracerPointsChanged', points: null, meta: null }));
        return true;
      }
      default:
        return false;
    }
  },

  async onRequest(request: Party.Request, ctx: PluginContext, state: StoryTracerState): Promise<Response | null> {
    const url = new URL(request.url);
    if (request.method === 'POST' && url.pathname.endsWith('/storyTracerSetPoints')) {
      try {
        const body = await request.json<{ userId: string; points: StoryTracerPoint[]; meta: StoryTracerMeta }>();
        state.points = body.points;
        state.meta = body.meta;
        void ctx.persistState();
        ctx.broadcast(JSON.stringify({ type: 'storyTracerPointsChanged', points: body.points, meta: body.meta }));
        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
      } catch (err) {
        console.error('[storyTracer] error processing setPoints:', err);
        return new Response('Invalid request', { status: 400 });
      }
    }
    return null;
  },

  onActivate() {},
  onDeactivate() {},

  getPersistedState(state) {
    return { points: state.points, meta: state.meta };
  },

  applyPersistedState(state, saved: unknown) {
    const s = saved as { points?: StoryTracerPoint[] | null; meta?: StoryTracerMeta | null };
    if (s.points !== undefined) state.points = s.points ?? null;
    if (s.meta !== undefined) state.meta = s.meta ?? null;
  },
};
