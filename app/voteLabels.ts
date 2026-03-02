export interface ReactionLabelSet {
  agree: string;
  disagree: string;
  pass: string;
  hint?: string;
  hintLinkText?: string;
  hintUrl?: string;
}

export const REACTION_LABEL_PRESETS: Record<string, ReactionLabelSet> = {
  default: {
    agree: 'Agree', disagree: 'Disagree', pass: 'Pass',
    hint: 'From Polis. See: ',
    hintLinkText: '"Pass button reflections"',
    hintUrl: 'https://github.com/compdemocracy/polis/discussions/774',
  },
  abu: {
    agree: 'A', disagree: 'B', pass: 'U',
    hint: "See: ORI's ",
    hintLinkText: 'A/B/U Review System',
    hintUrl: 'https://openresearchinstitute.org/onboarding/A_B_U.html',
  },
  atomic: {
    agree: 'Attracted', disagree: 'Repelled', pass: 'Neutral',
    hint: 'Inspired by atomic forces',
  },
  valence: {
    agree: 'Positive', disagree: 'Negative', pass: 'Neutral',
    hint: 'Inspired by ',
    hintLinkText: 'psychological valence',
    hintUrl: 'https://en.wikipedia.org/wiki/Valence_(psychology)',
  },
};

const STORAGE_KEY = 'polis_label_set';

export function encodeCustomLabels(agree: string, disagree: string, pass: string): string {
  const str = [agree, disagree, pass].map(encodeURIComponent).join('|');
  return btoa(str);
}

export function decodeCustomLabels(encoded: string): ReactionLabelSet | null {
  try {
    const parts = atob(encoded).split('|').map(decodeURIComponent);
    if (parts.length === 3 && parts.every(p => p.length > 0)) {
      return { agree: parts[0], disagree: parts[1], pass: parts[2] };
    }
  } catch {}
  return null;
}

export function getReactionLabelSet(name?: string): ReactionLabelSet | null {
  const key = name ?? localStorage.getItem(STORAGE_KEY) ?? '';
  if (key === 'none') return null;
  if (key && key in REACTION_LABEL_PRESETS) return REACTION_LABEL_PRESETS[key];
  if (key) {
    const custom = decodeCustomLabels(key);
    if (custom) return custom;
  }
  return REACTION_LABEL_PRESETS.default;
}
