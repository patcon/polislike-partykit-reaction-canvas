const ALGORITHM_OPTIONS: { value: string; label: string; description: string }[] = [
  { value: 'first-available', label: 'First Available', description: 'Paired instantly with the longest-waiting participant (FIFO)' },
];

interface PanelSettingsModalVoiceCallProps {
  currentAlgorithm: string;
  onSubmit: (algorithm: string) => void;
  onClose: () => void;
}

export default function PanelSettingsModalVoiceCall({ currentAlgorithm, onSubmit, onClose }: PanelSettingsModalVoiceCallProps) {
  return (
    <div className="github-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="github-modal">
        <p className="github-modal-title">Voice calls settings</p>

        <p style={{ color: '#ccc', fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Matching Mode</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          {ALGORITHM_OPTIONS.map(({ value, label, description }) => (
            <label key={value} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
              <input
                type="radio"
                name="callAlgorithm"
                value={value}
                checked={currentAlgorithm === value}
                onChange={() => onSubmit(value)}
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
