import { useState } from "react";

interface PanelSettingsModalArrivalCanvasProps {
  currentCapacity: number;
  onSubmit: (capacity: number) => void;
  onClose: () => void;
}

export default function PanelSettingsModalArrivalCanvas({ currentCapacity, onSubmit, onClose }: PanelSettingsModalArrivalCanvasProps) {
  const [input, setInput] = useState(String(currentCapacity));
  const parsed = parseInt(input, 10);
  const isValid = !isNaN(parsed) && parsed >= 1;

  const handleSave = () => {
    if (!isValid) return;
    onSubmit(parsed);
    onClose();
  };

  return (
    <div className="app-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="app-modal">
        <p className="app-modal-title">Arrival Canvas settings</p>
        <p className="app-modal-body">Set the room capacity. The THX deep note crescendo plays when this many participants have arrived.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 12, color: '#aaa' }}>Room capacity</span>
            <input
              className="app-modal-input"
              type="number"
              min={1}
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="50"
            />
          </label>
        </div>
        <button className="app-modal-btn-primary" onClick={handleSave} disabled={!isValid} style={{ marginTop: 16 }}>
          Save
        </button>
        <button className="app-modal-btn-dismiss" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}
