interface CanvasSettingsModalProps {
  showNowLabel: boolean;
  onChangeShowNowLabel: (v: boolean) => void;
  ownValenceDisplay: 'background' | 'labels' | 'none';
  onChangeOwnValenceDisplay: (mode: 'background' | 'labels' | 'none') => void;
  onClose: () => void;
}

const OWN_VALENCE_OPTIONS: { value: 'background' | 'labels' | 'none'; label: string; description: string }[] = [
  { value: 'background', label: 'Background', description: 'Canvas background shifts color as you move between regions' },
  { value: 'labels', label: 'Labels', description: 'The label for your current region gets a subtle color highlight' },
  { value: 'none', label: 'None', description: 'No visual feedback for your own position' },
];

export default function CanvasSettingsModal({ showNowLabel, onChangeShowNowLabel, ownValenceDisplay, onChangeOwnValenceDisplay, onClose }: CanvasSettingsModalProps) {
  return (
    <div className="github-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="github-modal">
        <p className="github-modal-title">Reaction Canvas settings</p>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', color: '#ccc', fontSize: 14, marginBottom: 8 }}>
          <input
            type="checkbox"
            checked={showNowLabel}
            onChange={e => onChangeShowNowLabel(e.target.checked)}
            style={{ width: 16, height: 16, cursor: 'pointer' }}
          />
          Show "Now" label on canvas
        </label>
        <p style={{ color: '#666', fontSize: 12, marginBottom: 20 }}>
          Displays the current moment label at the top of the canvas for all participants. Clears when the moment is snapped.
        </p>

        <p style={{ color: '#ccc', fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Display own valence via</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          {OWN_VALENCE_OPTIONS.map(({ value, label, description }) => (
            <label key={value} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
              <input
                type="radio"
                name="ownValenceDisplay"
                value={value}
                checked={ownValenceDisplay === value}
                onChange={() => onChangeOwnValenceDisplay(value)}
                style={{ marginTop: 2, cursor: 'pointer', flexShrink: 0 }}
              />
              <span>
                <span style={{ color: '#ccc', fontSize: 14 }}>{label}</span>
                <span style={{ display: 'block', color: '#666', fontSize: 12 }}>{description}</span>
              </span>
            </label>
          ))}
        </div>

        <button className="github-modal-btn-dismiss" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
