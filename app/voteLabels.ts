export interface ReactionLabelSet {
  agree: string;
  disagree: string;
  pass: string;
}

export const REACTION_LABEL_PRESETS: Record<string, ReactionLabelSet> = {
  default:    { agree: 'AGREE',   disagree: 'DISAGREE', pass: 'PASS'    },
  yesno:      { agree: 'YES',     disagree: 'NO',       pass: 'SKIP'    },
  supportive: { agree: 'SUPPORT', disagree: 'OPPOSE',   pass: 'NEUTRAL' },
};

const STORAGE_KEY = 'polis_label_set';

export function getReactionLabelSet(): ReactionLabelSet {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && stored in REACTION_LABEL_PRESETS) {
    return REACTION_LABEL_PRESETS[stored];
  }
  return REACTION_LABEL_PRESETS.default;
}
