import { describe, it, expect } from 'vitest';
import { getIndexRedirect, getRoomRedirect } from '../app/utils/routing';

// .html / SPA path routing is handled by PartyKit's built-in `serve.singlePageApp`
// config (partykit.json), not by application code, so there is nothing to unit-test there.
// Server HTTP endpoints (votes, debug-state, Polis proxy) are covered in party/tests/onRequest.test.ts.

describe('getIndexRedirect', () => {
  describe('?room= param present', () => {
    it('?room=test#v4 → /test (strips redundant hash)', () => {
      expect(getIndexRedirect('?room=test', 'v4')).toBe('/test');
    });

    it('?room=test (no hash) → /test', () => {
      expect(getIndexRedirect('?room=test', '')).toBe('/test');
    });

    it('?room=test#v5 → /test#v5 (preserves non-V4 hash)', () => {
      expect(getIndexRedirect('?room=test', 'v5')).toBe('/test#v5');
    });

    it('?room=test#v2 → /test#v2', () => {
      expect(getIndexRedirect('?room=test', 'v2')).toBe('/test#v2');
    });

    it('?room=test#v1 → /test#v1', () => {
      expect(getIndexRedirect('?room=test', 'v1')).toBe('/test#v1');
    });

    it('?room=test&interface=emcee#v4 → /test?interface=emcee (strips hash, preserves other params)', () => {
      expect(getIndexRedirect('?room=test&interface=emcee', 'v4')).toBe('/test?interface=emcee');
    });

    it('?room=test&interface=emcee#v5 → /test?interface=emcee#v5', () => {
      expect(getIndexRedirect('?room=test&interface=emcee', 'v5')).toBe('/test?interface=emcee#v5');
    });
  });

  describe('no ?room= param, hash-only legacy URLs', () => {
    it('#v4 → /default', () => {
      expect(getIndexRedirect('', 'v4')).toBe('/default');
    });

    it('#v5 → /default#v5', () => {
      expect(getIndexRedirect('', 'v5')).toBe('/default#v5');
    });

    it('#v1 → /default#v1', () => {
      expect(getIndexRedirect('', 'v1')).toBe('/default#v1');
    });

    it('#v2 → /default#v2', () => {
      expect(getIndexRedirect('', 'v2')).toBe('/default#v2');
    });
  });

  describe('no redirect needed', () => {
    it('/ (no room, no hash) → null', () => {
      expect(getIndexRedirect('', '')).toBeNull();
    });

    it('/#old → null (front page legacy route, not redirected to /default)', () => {
      expect(getIndexRedirect('', 'old')).toBeNull();
    });
  });
});

describe('getRoomRedirect', () => {
  describe('redundant #v4 hash', () => {
    it('/test#v4 → /test (strips hash)', () => {
      expect(getRoomRedirect('/test', '', 'v4')).toBe('/test');
    });

    it('/test?interface=emcee#v4 → /test?interface=emcee (strips hash, preserves params)', () => {
      expect(getRoomRedirect('/test', '?interface=emcee', 'v4')).toBe('/test?interface=emcee');
    });
  });

  describe('legacy ?room= param on a room path', () => {
    it('/other?room=test#v4 → /test', () => {
      expect(getRoomRedirect('/other', '?room=test', 'v4')).toBe('/test');
    });

    it('/other?room=test (no hash) → /test', () => {
      expect(getRoomRedirect('/other', '?room=test', '')).toBe('/test');
    });

    it('/other?room=test#v5 → /test#v5', () => {
      expect(getRoomRedirect('/other', '?room=test', 'v5')).toBe('/test#v5');
    });

    it('/other?room=test&interface=emcee#v4 → /test?interface=emcee', () => {
      expect(getRoomRedirect('/other', '?room=test&interface=emcee', 'v4')).toBe('/test?interface=emcee');
    });
  });

  describe('no redirect needed', () => {
    it('/test (no hash, no ?room) → null', () => {
      expect(getRoomRedirect('/test', '', '')).toBeNull();
    });

    it('/test#v5 → null', () => {
      expect(getRoomRedirect('/test', '', 'v5')).toBeNull();
    });

    it('/test?interface=emcee → null', () => {
      expect(getRoomRedirect('/test', '?interface=emcee', '')).toBeNull();
    });
  });
});
