import { describe, it, expect } from 'vitest';
import {
  SIM_PREFIX,
  REPLAY_PREFIX,
  isSimulatedUserId,
} from '../../app/utils/simulatedUser';

describe('simulatedUser prefixes', () => {
  it('exposes the sim_ and replay_ prefixes', () => {
    expect(SIM_PREFIX).toBe('sim_');
    expect(REPLAY_PREFIX).toBe('replay_');
  });
});

describe('isSimulatedUserId', () => {
  it('recognizes sim_ ids (new demo-page simulator)', () => {
    expect(isSimulatedUserId('sim_0')).toBe(true);
    expect(isSimulatedUserId('sim_iygcyv79z')).toBe(true);
  });

  it('recognizes replay_ ids (existing emcee playback) unchanged', () => {
    expect(isSimulatedUserId('replay_abc123')).toBe(true);
  });

  it('treats real user ids as not simulated', () => {
    expect(isSimulatedUserId('a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d')).toBe(false);
    expect(isSimulatedUserId('sim-driver')).toBe(false); // driver connection, not a sim cursor
    expect(isSimulatedUserId('')).toBe(false);
  });

  it('requires the trailing underscore (prefix, not substring)', () => {
    expect(isSimulatedUserId('sim')).toBe(false);
    expect(isSimulatedUserId('simulated')).toBe(false);
    expect(isSimulatedUserId('replayer')).toBe(false);
  });
});
