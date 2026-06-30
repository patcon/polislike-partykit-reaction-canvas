import { describe, it, expect } from 'vitest';
import { PANEL_REGISTRY, STANDALONE_PANELS, SOLO_SCREEN_LABEL } from '../app/panelRegistry';

describe('PANEL_REGISTRY', () => {
  it('every entry has all required fields with the correct types', () => {
    for (const panel of PANEL_REGISTRY) {
      expect(typeof panel.id).toBe('string');
      expect(panel.id.length).toBeGreaterThan(0);
      expect(typeof panel.label).toBe('string');
      expect(panel.label.length).toBeGreaterThan(0);
      expect(typeof panel.description).toBe('string');

      expect(typeof panel.canStandalone).toBe('boolean');
      expect(typeof panel.canScreenMount).toBe('boolean');
    }
  });

  it('has no duplicate IDs', () => {
    const ids = PANEL_REGISTRY.map(p => p.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('has no duplicate labels', () => {
    const labels = PANEL_REGISTRY.map(p => p.label);
    const unique = new Set(labels);
    expect(unique.size).toBe(labels.length);
  });
});

describe('STANDALONE_PANELS', () => {
  it('is a strict subset of PANEL_REGISTRY', () => {
    const registryIds = new Set(PANEL_REGISTRY.map(p => p.id));
    for (const panel of STANDALONE_PANELS) {
      expect(registryIds.has(panel.id)).toBe(true);
    }
  });

  it('contains exactly the entries where canStandalone is true', () => {
    const expected = PANEL_REGISTRY.filter(p => p.canStandalone).map(p => p.id).sort();
    const actual = STANDALONE_PANELS.map(p => p.id).sort();
    expect(actual).toEqual(expected);
  });
});

describe('SOLO_SCREEN_LABEL', () => {
  it('is a non-empty string', () => {
    expect(typeof SOLO_SCREEN_LABEL).toBe('string');
    expect(SOLO_SCREEN_LABEL.length).toBeGreaterThan(0);
  });
});
