import { describe, it, expect, vi } from 'vitest';
import { signatureServer } from './server';
import { makeCtx, makeConn } from '../testHelpers';

describe('signatureServer', () => {
  describe('clearSignature', () => {
    it('broadcasts signatureCleared with userId and returns true', () => {
      const ctx = makeCtx();
      const handled = signatureServer.onMessage('clearSignature', { userId: 'alice' }, makeConn(), ctx, signatureServer.createState(), 'signature');
      expect(handled).toBe(true);
      const broadcast = ctx.broadcast as ReturnType<typeof vi.fn>;
      expect(JSON.parse(broadcast.mock.calls[0][0])).toEqual({ type: 'signatureCleared', userId: 'alice' });
    });
  });

  describe('strokeSegment', () => {
    it('broadcasts the strokeSegment payload and returns true', () => {
      const ctx = makeCtx();
      const payload = { userId: 'alice', strokeId: 's1', points: [], isFinal: false };
      const handled = signatureServer.onMessage('strokeSegment', payload, makeConn(), ctx, signatureServer.createState(), 'signature');
      expect(handled).toBe(true);
      const broadcast = ctx.broadcast as ReturnType<typeof vi.fn>;
      const msg = JSON.parse(broadcast.mock.calls[0][0]);
      expect(msg).toMatchObject({ type: 'strokeSegment', userId: 'alice', strokeId: 's1', isFinal: false });
    });
  });

  describe('unhandled message types', () => {
    it('returns false for unknown types', () => {
      const handled = signatureServer.onMessage('unknownEvent', {}, makeConn(), makeCtx(), signatureServer.createState(), 'signature');
      expect(handled).toBe(false);
    });
  });
});
