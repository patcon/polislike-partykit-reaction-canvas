export interface ReactionLabelSet {
  agree: string;
  disagree: string;
  pass: string;
}

export const REACTION_LABEL_PRESETS: Record<string, ReactionLabelSet> = {
  default:    { agree: 'Agree',   disagree: 'Disagree', pass: 'Pass'    },
  yesno:      { agree: 'Yes',     disagree: 'No',       pass: 'Skip'    },
  supportive: { agree: 'Support', disagree: 'Oppose',   pass: 'Neutral' },
  abu:        { agree: 'A',       disagree: 'B',        pass: 'U'       },
};

const STORAGE_KEY = 'polis_label_set';

export function getReactionLabelSet(name?: string): ReactionLabelSet | null {
  const key = name ?? localStorage.getItem(STORAGE_KEY) ?? '';
  if (key === 'none') return null;
  if (key && key in REACTION_LABEL_PRESETS) {
    return REACTION_LABEL_PRESETS[key];
  }
  return REACTION_LABEL_PRESETS.default;
}
