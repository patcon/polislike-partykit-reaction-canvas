import { useState } from "react";

interface HapticPushModalProps {
  onDismiss: () => void;
  suppressed: boolean;
  onSuppressChange: (suppress: boolean) => void;
}

export default function HapticPushModal({ onDismiss, suppressed, onSuppressChange }: HapticPushModalProps) {
  const [suppress, setSuppress] = useState(suppressed);

  const handleOk = () => {
    onSuppressChange(suppress);
    onDismiss();
  };

  return (
    <div className="github-modal-overlay" onClick={handleOk}>
      <div className="github-modal" onClick={e => e.stopPropagation()}>
        <div className="github-modal-title">Haptic feedback unavailable</div>
        <div className="github-modal-body">
          Your device doesn't support haptic feedback via web apps. You can watch the vibration icon for a visual cue instead.
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#888', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={!suppress}
            onChange={e => setSuppress(!e.target.checked)}
          />
          Show this popup when a buzz is sent
        </label>
        <button className="github-modal-btn-dismiss" onClick={handleOk}>OK</button>
      </div>
    </div>
  );
}
