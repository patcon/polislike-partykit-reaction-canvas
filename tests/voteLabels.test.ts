// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  REACTION_LABEL_PRESETS,
  encodeCustomLabels,
  decodeCustomLabels,
  getCustomLabelHistory,
  saveCustomLabelToHistory,
  removeCustomLabelFromHistory,
  getReactionLabelSet,
} from '../app/voteLabels';

const HISTORY_KEY = 'polis_custom_label_history';
const SET_KEY = 'polis_label_set';

beforeEach(() => {
  localStorage.clear();
});

describe('encodeCustomLabels / decodeCustomLabels', () => {
  it('round-trips a label set', () => {
    const encoded = encodeCustomLabels('Yes', 'No', 'Skip');
    expect(decodeCustomLabels(encoded)).toEqual({ positive: 'Yes', negative: 'No', neutral: 'Skip' });
  });

  it('round-trips labels containing the "|" delimiter and other special chars', () => {
    const encoded = encodeCustomLabels('a|b', 'c d', 'é/ñ');
    expect(decodeCustomLabels(encoded)).toEqual({ positive: 'a|b', negative: 'c d', neutral: 'é/ñ' });
  });

  it('returns null for malformed base64', () => {
    expect(decodeCustomLabels('!!!not base64!!!')).toBeNull();
  });

  it('returns null when there are not exactly three parts', () => {
    expect(decodeCustomLabels(btoa('only|two'))).toBeNull();
  });

  it('returns null when any part is empty', () => {
    expect(decodeCustomLabels(btoa(['a', '', 'c'].join('|')))).toBeNull();
  });
});

describe('getCustomLabelHistory', () => {
  it('returns an empty array when nothing is stored', () => {
    expect(getCustomLabelHistory()).toEqual([]);
  });

  it('returns an empty array for non-array stored JSON', () => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify({ not: 'an array' }));
    expect(getCustomLabelHistory()).toEqual([]);
  });

  it('returns an empty array for invalid JSON', () => {
    localStorage.setItem(HISTORY_KEY, '{broken');
    expect(getCustomLabelHistory()).toEqual([]);
  });

  it('filters out malformed entries', () => {
    localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify([
        { positive: 'A', negative: 'B', neutral: 'U' },
        { positive: 'A', negative: 'B' }, // missing neutral
        null,
        'string',
      ]),
    );
    expect(getCustomLabelHistory()).toEqual([{ positive: 'A', negative: 'B', neutral: 'U' }]);
  });
});

describe('saveCustomLabelToHistory', () => {
  it('adds a custom label to the front of the history', () => {
    saveCustomLabelToHistory({ positive: 'Hot', negative: 'Cold', neutral: 'Warm' });
    expect(getCustomLabelHistory()).toEqual([{ positive: 'Hot', negative: 'Cold', neutral: 'Warm' }]);
  });

  it('does not store sets that match a preset (case-insensitive)', () => {
    saveCustomLabelToHistory({ positive: 'agree', negative: 'disagree', neutral: 'pass' });
    expect(getCustomLabelHistory()).toEqual([]);
  });

  it('de-duplicates and moves an existing entry to the front', () => {
    saveCustomLabelToHistory({ positive: 'A1', negative: 'B1', neutral: 'C1' });
    saveCustomLabelToHistory({ positive: 'A2', negative: 'B2', neutral: 'C2' });
    saveCustomLabelToHistory({ positive: 'A1', negative: 'B1', neutral: 'C1' });
    const history = getCustomLabelHistory();
    expect(history).toEqual([
      { positive: 'A1', negative: 'B1', neutral: 'C1' },
      { positive: 'A2', negative: 'B2', neutral: 'C2' },
    ]);
  });

  it('caps the history at five entries', () => {
    for (let i = 0; i < 7; i++) {
      saveCustomLabelToHistory({ positive: `P${i}`, negative: `N${i}`, neutral: `Z${i}` });
    }
    const history = getCustomLabelHistory();
    expect(history).toHaveLength(5);
    expect(history[0]).toEqual({ positive: 'P6', negative: 'N6', neutral: 'Z6' });
  });
});

describe('removeCustomLabelFromHistory', () => {
  it('removes the entry at the given index and returns the result', () => {
    saveCustomLabelToHistory({ positive: 'A1', negative: 'B1', neutral: 'C1' });
    saveCustomLabelToHistory({ positive: 'A2', negative: 'B2', neutral: 'C2' });
    // history is [A2, A1]; remove index 0 → [A1]
    const result = removeCustomLabelFromHistory(0);
    expect(result).toEqual([{ positive: 'A1', negative: 'B1', neutral: 'C1' }]);
    expect(getCustomLabelHistory()).toEqual([{ positive: 'A1', negative: 'B1', neutral: 'C1' }]);
  });
});

describe('getReactionLabelSet', () => {
  it('returns a named preset', () => {
    expect(getReactionLabelSet('genz')).toEqual(REACTION_LABEL_PRESETS.genz);
  });

  it('returns null for the "none" sentinel', () => {
    expect(getReactionLabelSet('none')).toBeNull();
  });

  it('decodes a custom base64 key', () => {
    const encoded = encodeCustomLabels('Yes', 'No', 'Skip');
    expect(getReactionLabelSet(encoded)).toEqual({ positive: 'Yes', negative: 'No', neutral: 'Skip' });
  });

  it('falls back to the default preset for an unknown key', () => {
    expect(getReactionLabelSet('not-a-real-preset')).toEqual(REACTION_LABEL_PRESETS.default);
  });

  it('reads from localStorage when no name is provided', () => {
    localStorage.setItem(SET_KEY, 'abu');
    expect(getReactionLabelSet()).toEqual(REACTION_LABEL_PRESETS.abu);
  });

  it('returns the default preset when nothing is stored and no name is given', () => {
    expect(getReactionLabelSet()).toEqual(REACTION_LABEL_PRESETS.default);
  });
});
