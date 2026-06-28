// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { generateUUID, getPersistentUserId } from '../app/utils/userId';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('generateUUID', () => {
  it('returns a v4-formatted UUID', () => {
    expect(generateUUID()).toMatch(UUID_V4);
  });

  it('returns unique values across calls', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateUUID()));
    expect(ids.size).toBe(100);
  });

  describe('fallback when crypto.randomUUID is unavailable (insecure context)', () => {
    let original: typeof crypto.randomUUID | undefined;

    beforeEach(() => {
      original = crypto.randomUUID;
      // Simulate an HTTP LAN context where randomUUID is missing.
      (crypto as { randomUUID?: unknown }).randomUUID = undefined;
    });

    afterEach(() => {
      (crypto as { randomUUID?: unknown }).randomUUID = original;
    });

    it('still produces a valid v4 UUID via the Math.random fallback', () => {
      expect(generateUUID()).toMatch(UUID_V4);
    });
  });
});

describe('getPersistentUserId', () => {
  beforeEach(() => localStorage.clear());

  it('generates and persists an id on first call', () => {
    const id = getPersistentUserId();
    expect(id).toMatch(UUID_V4);
    expect(localStorage.getItem('polis_user_id')).toBe(id);
  });

  it('returns the same id on subsequent calls', () => {
    const first = getPersistentUserId();
    const second = getPersistentUserId();
    expect(second).toBe(first);
  });
});
