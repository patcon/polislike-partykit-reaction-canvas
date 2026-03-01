export interface ReactionLabelSet {
  agree: string;
  disagree: string;
  pass: string;
}

export const REACTION_LABEL_PRESETS: Record<string, ReactionLabelSet> = {
  default:    { agree: 'AGREE',   disagree: 'DISAGREE', pass: 'PASS'    },
  yesno:      { agree: 'YES',     disagree: 'NO',       pass: 'SKIP'    },
  supportive: { agree: 'SUPPORT', disagree: 'OPPOSE',   pass: 'NEUTRAL' },
  abu:        { agree: 'A',       disagree: 'B',        pass: 'U'       },
};

const STORAGE_KEY = 'polis_label_set';

export function getReactionLabelSet(name?: string): ReactionLabelSet {
  const key = name ?? localStorage.getItem(STORAGE_KEY) ?? '';
  if (key && key in REACTION_LABEL_PRESETS) {
    return REACTION_LABEL_PRESETS[key];
  }
  return REACTION_LABEL_PRESETS.default;
}
