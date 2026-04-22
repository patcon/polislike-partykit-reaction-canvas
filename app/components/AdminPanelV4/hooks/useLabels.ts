import { useState, useMemo } from "react";
import {
  REACTION_LABEL_PRESETS,
  getCustomLabelHistory,
  saveCustomLabelToHistory,
  removeCustomLabelFromHistory,
} from "../../../voteLabels";
import type { ReactionLabelSet } from "../../../voteLabels";
import type PartySocket from "partysocket";

export function useLabels(socket: PartySocket) {
  const [labelSelected, setLabelSelected] = useState<string>('default');
  const [customPositive, setCustomPositive] = useState('');
  const [customNegative, setCustomNegative] = useState('');
  const [customNeutral, setCustomNeutral]   = useState('');
  const [customHistory, setCustomHistory]   = useState<ReactionLabelSet[]>(() => getCustomLabelHistory());

  const activeLabels = useMemo<ReactionLabelSet>(() => {
    if (labelSelected === 'custom') {
      return {
        positive: customPositive || 'Positive',
        negative: customNegative || 'Negative',
        neutral:  customNeutral  || 'Neutral',
      };
    }
    return REACTION_LABEL_PRESETS[labelSelected] ?? REACTION_LABEL_PRESETS['default'];
  }, [labelSelected, customPositive, customNegative, customNeutral]);

  const applyServerLabels = (labels: ReactionLabelSet | null) => {
    if (labels === null) {
      setLabelSelected('none');
      return;
    }
    const matchedKey = Object.entries(REACTION_LABEL_PRESETS).find(
      ([, set]) => set.positive === labels.positive && set.negative === labels.negative && set.neutral === labels.neutral
    )?.[0];
    if (matchedKey) {
      setLabelSelected(matchedKey);
    } else {
      setLabelSelected('custom');
      setCustomPositive(labels.positive);
      setCustomNegative(labels.negative);
      setCustomNeutral(labels.neutral);
    }
  };

  const selectPreset = (key: string) => {
    setLabelSelected(key);
    if (key !== 'custom' && key !== 'none') {
      const preset = REACTION_LABEL_PRESETS[key];
      if (preset) {
        setCustomPositive(preset.positive);
        setCustomNegative(preset.negative);
        setCustomNeutral(preset.neutral);
      }
    }
  };

  const sendLabels = () => {
    let labels: ReactionLabelSet | null;
    if (labelSelected === 'none') {
      labels = null;
    } else if (labelSelected === 'custom') {
      labels = { positive: customPositive, negative: customNegative, neutral: customNeutral };
      saveCustomLabelToHistory(labels);
      setCustomHistory(getCustomLabelHistory());
    } else {
      const preset = REACTION_LABEL_PRESETS[labelSelected];
      labels = preset ? { positive: preset.positive, negative: preset.negative, neutral: preset.neutral } : null;
    }
    socket.send(JSON.stringify({ type: 'setRoomLabels', labels }));
  };

  const handleSocketEvent = (data: Record<string, unknown>) => {
    if (data.type === 'roomLabelsChanged') {
      applyServerLabels((data.labels as ReactionLabelSet | null) ?? null);
    }
  };

  return {
    labelSelected, setLabelSelected,
    customPositive, setCustomPositive,
    customNegative, setCustomNegative,
    customNeutral,  setCustomNeutral,
    customHistory,  setCustomHistory,
    activeLabels,
    applyServerLabels,
    selectPreset,
    sendLabels,
    handleSocketEvent,
    removeCustomLabelFromHistory,
  };
}
