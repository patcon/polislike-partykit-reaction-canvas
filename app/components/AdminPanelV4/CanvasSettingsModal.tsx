interface CanvasSettingsModalProps {
  showNowLabel: boolean;
  onChangeShowNowLabel: (v: boolean) => void;
  onClose: () => void;
}

export default function CanvasSettingsModal({ showNowLabel, onChangeShowNowLabel, onClose }: CanvasSettingsModalProps) {
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
        <p style={{ color: '#666', fontSize: 12, marginBottom: 16 }}>
          Displays the current moment label at the top of the canvas for all participants. Clears when the moment is snapped.
        </p>
        <button className="github-modal-btn-dismiss" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
