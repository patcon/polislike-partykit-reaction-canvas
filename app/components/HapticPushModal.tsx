import { useState } from "react";

interface HapticPushModalProps {
  onDismiss: () => void;
  onSuppress: () => void;
}

export default function HapticPushModal({ onDismiss, onSuppress }: HapticPushModalProps) {
  const [suppress, setSuppress] = useState(false);

  const handleOk = () => {
    if (suppress) onSuppress();
    onDismiss();
  };

  return (
    <div className="github-modal-overlay" onClick={handleOk}>
      <div className="github-modal" onClick={e => e.stopPropagation()}>
        <div className="github-modal-title">Haptic feedback unavailable</div>
        <div className="github-modal-body">
          Your device doesn't support haptic feedback via web apps.
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#888', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={suppress}
            onChange={e => setSuppress(e.target.checked)}
          />
          Don't show again this session
        </label>
        <button className="github-modal-btn-dismiss" onClick={handleOk}>OK</button>
      </div>
    </div>
  );
}
