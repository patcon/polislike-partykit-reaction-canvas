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
});
