import { useState } from "react";
import type { GreeterConfig } from "../../types";

interface PanelSettingsModalGreeterProps {
  onSubmit: (config: GreeterConfig) => void;
  onClose: () => void;
  current?: GreeterConfig | null;
}

export default function PanelSettingsModalGreeter({ onSubmit, onClose, current }: PanelSettingsModalGreeterProps) {
  const [eventUrl, setEventUrl] = useState(current?.eventUrl ?? 'https://guild.host/civic-tech-toronto');

  const handleSave = () => {
    onSubmit({ eventUrl });
    onClose();
  };

  return (
    <div className="github-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="github-modal">
        <p className="github-modal-title">Greeter config</p>
        <p className="github-modal-body">Set a Guild event URL, or a group URL to auto-use the next upcoming event.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 12, color: '#aaa' }}>Guild event URL</span>
            <input
              className="github-modal-input"
              type="text"
              value={eventUrl}
              onChange={e => setEventUrl(e.target.value)}
              placeholder="https://guild.host/events/… or https://guild.host/your-group"

            />
          </label>
        </div>
        <button className="github-modal-btn-primary" onClick={handleSave} style={{ marginTop: 16 }}>
          Save
        </button>
        <button className="github-modal-btn-dismiss" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}
