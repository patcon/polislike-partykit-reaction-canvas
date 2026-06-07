import { useState } from "react";
import { useAdminSocket } from '../../app/components/panels/AdminPanelNoDB/AdminSocketContext';
import type { GreeterConfig } from "./types";

export default function GreeterConfigModal({ onClose }: { onClose: () => void }) {
  const { send, getLastMessage } = useAdminSocket();
  const current = getLastMessage('greeterConfigChanged')?.config as GreeterConfig | null | undefined;
  const [eventUrl, setEventUrl] = useState(current?.eventUrl ?? 'https://guild.host/civic-tech-toronto');

  const handleSave = () => {
    send({ type: 'setGreeterConfig', config: { eventUrl } });
    onClose();
  };

  return (
    <div className="app-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="app-modal">
        <p className="app-modal-title">Greeter config</p>
        <p className="app-modal-body">Set a Guild event URL, or a group URL to auto-use the next upcoming event.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 12, color: '#aaa' }}>Guild event URL</span>
            <input
              className="app-modal-input"
              type="text"
              value={eventUrl}
              onChange={e => setEventUrl(e.target.value)}
              placeholder="https://guild.host/events/… or https://guild.host/your-group"
            />
          </label>
        </div>
        <button className="app-modal-btn-primary" onClick={handleSave} style={{ marginTop: 16 }}>
          Save
        </button>
        <button className="app-modal-btn-dismiss" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}
