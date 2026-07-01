// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLocalStorageState } from '../app/hooks/useLocalStorageState';

beforeEach(() => localStorage.clear());

describe('useLocalStorageState', () => {
  it('returns the initial value when nothing is stored', () => {
    const { result } = renderHook(() => useLocalStorageState('k', 5));
    expect(result.current[0]).toBe(5);
  });

  it('hydrates from a previously stored value', () => {
    localStorage.setItem('k', JSON.stringify(true));
    const { result } = renderHook(() => useLocalStorageState('k', false));
    expect(result.current[0]).toBe(true);
  });

  it('persists updates to localStorage', () => {
    const { result } = renderHook(() => useLocalStorageState('k', 5));
    act(() => result.current[1](9));
    expect(result.current[0]).toBe(9);
    expect(JSON.parse(localStorage.getItem('k')!)).toBe(9);
  });

  it('falls back to the initial value when stored JSON is corrupt', () => {
    localStorage.setItem('k', '{not json');
    const { result } = renderHook(() => useLocalStorageState('k', 'def'));
    expect(result.current[0]).toBe('def');
  });

  it('scopes the storage key by room when provided', () => {
    const { result } = renderHook(() => useLocalStorageState('k', 0, { room: 'r1' }));
    act(() => result.current[1](7));
    expect(JSON.parse(localStorage.getItem('k-r1')!)).toBe(7);
    expect(localStorage.getItem('k')).toBeNull();
  });

  it('re-hydrates from the new key when the room changes', () => {
    localStorage.setItem('k-r1', JSON.stringify('a'));
    localStorage.setItem('k-r2', JSON.stringify('b'));
    const { result, rerender } = renderHook(
      ({ room }) => useLocalStorageState('k', 'def', { room }),
      { initialProps: { room: 'r1' } },
    );
    expect(result.current[0]).toBe('a');
    rerender({ room: 'r2' });
    expect(result.current[0]).toBe('b');
  });

  it('resets to initial when switching to a room with nothing stored', () => {
    localStorage.setItem('k-r1', JSON.stringify('a'));
    const { result, rerender } = renderHook(
      ({ room }) => useLocalStorageState('k', 'def', { room }),
      { initialProps: { room: 'r1' } },
    );
    expect(result.current[0]).toBe('a');
    rerender({ room: 'empty' });
    expect(result.current[0]).toBe('def');
  });
});
