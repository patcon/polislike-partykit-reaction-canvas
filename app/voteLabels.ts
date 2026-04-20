export interface ReactionLabelSet {
  positive: string;
  negative: string;
  neutral: string;
  hint?: string;
  hintLinkText?: string;
  hintUrl?: string;
}

export const REACTION_LABEL_PRESETS: Record<string, ReactionLabelSet> = {
  default: {
    positive: 'Agree', negative: 'Disagree', neutral: 'Pass',
    hint: 'From Polis. See: ',
    hintLinkText: '"Pass button reflections"',
    hintUrl: 'https://github.com/compdemocracy/polis/discussions/774',
  },
  abu: {
    positive: 'A', negative: 'B', neutral: 'U',
    hint: "See: ORI's ",
    hintLinkText: 'A/B/U Review System',
    hintUrl: 'https://openresearchinstitute.org/onboarding/A_B_U.html',
  },
  atomic: {
    positive: 'Attracted', negative: 'Repelled', neutral: 'Neutral',
    hint: 'Inspired by atomic forces',
  },
  valence: {
    positive: 'Positive', negative: 'Negative', neutral: 'Neutral',
    hint: 'Inspired by ',
    hintLinkText: 'psychological valence',
    hintUrl: 'https://en.wikipedia.org/wiki/Valence_(psychology)',
  },
  genz: {
    positive: 'Based', negative: 'Whack', neutral: 'Mid',
    hint: 'Inspired by my GenZ whisperers',
  },
  engagement: {
    positive: 'Engaged', negative: 'Disengaged', neutral: 'Baseline',
  },
};

const STORAGE_KEY = 'polis_label_set';
const HISTORY_STORAGE_KEY = 'polis_custom_label_history';
const HISTORY_MAX = 5;

export function encodeCustomLabels(positive: string, negative: string, neutral: string): string {
  const str = [positive, negative, neutral].map(encodeURIComponent).join('|');
  return btoa(str);
}

export function decodeCustomLabels(encoded: string): ReactionLabelSet | null {
  try {
    const parts = atob(encoded).split('|').map(decodeURIComponent);
    if (parts.length === 3 && parts.every(p => p.length > 0)) {
      return { positive: parts[0], negative: parts[1], neutral: parts[2] };
    }
  } catch {}
  return null;
}

export function getCustomLabelHistory(): ReactionLabelSet[] {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((e: unknown) =>
      e && typeof e === 'object' &&
      typeof (e as ReactionLabelSet).positive === 'string' &&
      typeof (e as ReactionLabelSet).negative === 'string' &&
      typeof (e as ReactionLabelSet).neutral === 'string'
    ) as ReactionLabelSet[];
  } catch {
    return [];
  }
}

function matchesPreset(labels: ReactionLabelSet): boolean {
  const lc = (s: string) => s.toLowerCase();
  return Object.values(REACTION_LABEL_PRESETS).some(p =>
    lc(p.positive) === lc(labels.positive) &&
    lc(p.negative) === lc(labels.negative) &&
    lc(p.neutral) === lc(labels.neutral)
  );
}

export function saveCustomLabelToHistory(labels: ReactionLabelSet): void {
  if (matchesPreset(labels)) return;
  const history = getCustomLabelHistory().filter(
    e => !(e.positive === labels.positive && e.negative === labels.negative && e.neutral === labels.neutral)
  );
  history.unshift({ positive: labels.positive, negative: labels.negative, neutral: labels.neutral });
  localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history.slice(0, HISTORY_MAX)));
}

export function removeCustomLabelFromHistory(index: number): ReactionLabelSet[] {
  const history = getCustomLabelHistory();
  history.splice(index, 1);
  localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
  return history;
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
