// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  parseInviteChain,
  appendSelfToChain,
  chainToEdges,
  getStoredChain,
  storeChain,
  buildInviteChainUrl,
} from '../app/utils/inviteChain';

beforeEach(() => {
  localStorage.clear();
});

describe('parseInviteChain', () => {
  it('returns an empty array when the param is absent', () => {
    expect(parseInviteChain('?room=test')).toEqual([]);
  });

  it('splits a comma-separated chain', () => {
    expect(parseInviteChain('?inviteChain=a,b,c')).toEqual(['a', 'b', 'c']);
  });

  it('drops empty segments', () => {
    expect(parseInviteChain('?inviteChain=a,,b,')).toEqual(['a', 'b']);
  });

  it('handles a leading "?" or none', () => {
    expect(parseInviteChain('inviteChain=x')).toEqual(['x']);
  });
});

describe('appendSelfToChain', () => {
  it('appends a new id to the end', () => {
    expect(appendSelfToChain(['a', 'b'], 'c')).toEqual(['a', 'b', 'c']);
  });

  it('does not append when the id is already present', () => {
    expect(appendSelfToChain(['a', 'b'], 'b')).toEqual(['a', 'b']);
  });

  it('does not mutate the input array', () => {
    const input = ['a'];
    appendSelfToChain(input, 'b');
    expect(input).toEqual(['a']);
  });
});

describe('chainToEdges', () => {
  it('builds consecutive directed edges', () => {
    expect(chainToEdges(['a', 'b', 'c'])).toEqual([
      ['a', 'b'],
      ['b', 'c'],
    ]);
  });

  it('returns no edges for a single-node chain', () => {
    expect(chainToEdges(['a'])).toEqual([]);
  });

  it('returns no edges for an empty chain', () => {
    expect(chainToEdges([])).toEqual([]);
  });
});

describe('getStoredChain / storeChain', () => {
  it('returns an empty array when nothing is stored', () => {
    expect(getStoredChain('room1')).toEqual([]);
  });

  it('round-trips a stored chain keyed by room', () => {
    storeChain('room1', ['a', 'b']);
    expect(getStoredChain('room1')).toEqual(['a', 'b']);
    expect(getStoredChain('room2')).toEqual([]);
  });

  it('returns an empty array for corrupt stored JSON', () => {
    localStorage.setItem('treevites-chain-room1', '{not json');
    expect(getStoredChain('room1')).toEqual([]);
  });
});

describe('buildInviteChainUrl', () => {
  it('appends self and serializes the chain into the inviteChain param', () => {
    const result = buildInviteChainUrl('?room=test', 'me', ['a', 'b']);
    const params = new URLSearchParams(result);
    expect(params.get('room')).toBe('test');
    expect(params.get('inviteChain')).toBe('a,b,me');
  });

  it('does not duplicate self if already in the chain', () => {
    const result = buildInviteChainUrl('', 'me', ['me', 'a']);
    expect(new URLSearchParams(result).get('inviteChain')).toBe('me,a');
  });

  it('overwrites an existing inviteChain param', () => {
    const result = buildInviteChainUrl('?inviteChain=old', 'me', ['a']);
    expect(new URLSearchParams(result).get('inviteChain')).toBe('a,me');
  });
});
