import { REACTION_LABEL_PRESETS, removeCustomLabelFromHistory } from "../../../voteLabels";
import type { ReactionLabelSet } from "../../../voteLabels";

interface LabelsTabProps {
  labelSelected: string;
  setLabelSelected: (v: string) => void;
  customPositive: string;
  setCustomPositive: (v: string) => void;
  customNegative: string;
  setCustomNegative: (v: string) => void;
  customNeutral: string;
  setCustomNeutral: (v: string) => void;
  customHistory: ReactionLabelSet[];
  setCustomHistory: (v: ReactionLabelSet[]) => void;
  selectPreset: (key: string) => void;
  sendLabels: () => void;
}

export default function LabelsTab({
  labelSelected, setLabelSelected,
  customPositive, setCustomPositive,
  customNegative, setCustomNegative,
  customNeutral,  setCustomNeutral,
  customHistory, setCustomHistory,
  selectPreset, sendLabels,
}: LabelsTabProps) {
  return (
    <div>
      <p style={{ marginBottom: 12, fontWeight: 600 }}>Reaction labels (shared for all participants):</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {Object.entries(REACTION_LABEL_PRESETS).map(([key, set]) => (
          <label key={key} style={{ display: 'block', cursor: 'pointer' }}>
            <input
              type="radio"
              name="labelSelected"
              value={key}
              checked={labelSelected === key}
              onChange={() => selectPreset(key)}
              style={{ marginRight: 8 }}
            />
            {set.positive} / {set.negative} / {set.neutral}
            {set.hint && (
              <span style={{ color: '#888', fontSize: 12, marginLeft: 8 }}>
                — {set.hint}
                {set.hintLinkText && set.hintUrl && (
                  <a href={set.hintUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#69f' }}>{set.hintLinkText}</a>
                )}
              </span>
            )}
          </label>
        ))}
        <label style={{ display: 'block', cursor: 'pointer' }}>
          <input
            type="radio"
            name="labelSelected"
            value="custom"
            checked={labelSelected === 'custom'}
            onChange={() => setLabelSelected('custom')}
            style={{ marginRight: 8 }}
          />
          Custom
        </label>
        {labelSelected === 'custom' && (
          <div style={{ marginLeft: 24, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {([['Positive', customPositive, setCustomPositive], ['Negative', customNegative, setCustomNegative], ['Neutral', customNeutral, setCustomNeutral]] as const).map(([slot, val, setter]) => (
              <div key={slot} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 64, color: '#aaa', fontSize: 13 }}>{slot}</span>
                <input
                  type="text"
                  value={val}
                  onChange={e => setter(e.target.value)}
                  placeholder={`${slot} label`}
                  style={{ background: '#333', border: '1px solid #555', color: '#eee', padding: '4px 8px', borderRadius: 4 }}
                />
              </div>
            ))}
            {customHistory.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                {customHistory.map((entry, i) => (
                  <div
                    key={i}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#2a2a2a', border: '1px solid #444', borderRadius: 4, padding: '3px 6px', fontSize: 12, color: '#aaa', cursor: 'pointer' }}
                    onClick={() => { setCustomPositive(entry.positive); setCustomNegative(entry.negative); setCustomNeutral(entry.neutral); }}
                  >
                    <span>{entry.positive} / {entry.negative} / {entry.neutral}</span>
                    <button
                      onClick={e => { e.stopPropagation(); setCustomHistory(removeCustomLabelFromHistory(i)); }}
                      style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', padding: '0 2px', fontSize: 13, lineHeight: 1 }}
                    >×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        <label style={{ display: 'block', cursor: 'pointer' }}>
          <input
            type="radio"
            name="labelSelected"
            value="none"
            checked={labelSelected === 'none'}
            onChange={() => setLabelSelected('none')}
            style={{ marginRight: 8 }}
          />
          None (hide labels)
        </label>
      </div>
      <button
        className="v3-admin-btn"
        style={{ marginTop: 16 }}
        onClick={sendLabels}
        disabled={labelSelected === 'custom' && (!customPositive || !customNegative || !customNeutral)}
      >
        Apply Labels
      </button>
    </div>
  );
}
