import { useState, useEffect } from 'react';
import { useAdminSocket } from '../../app/components/panels/AdminPanelNoDB/AdminSocketContext';

export default function HelloWorldConfigModal({ onClose }: { onClose: () => void }) {
  const { send, subscribe, getLastMessage } = useAdminSocket();

  const [message, setMessage] = useState<string>(() => {
    return (getLastMessage('helloWorldState')?.message as string) ?? 'Hello, world!';
  });

  useEffect(() => {
    return subscribe(data => {
      if (data.type === 'helloWorldState') setMessage(data.message as string);
    });
  }, [subscribe]);

  const handleSave = () => {
    send({ type: 'setHelloWorldMessage', message });
    onClose();
  };

  return (
    <div className="github-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="github-modal">
        <p className="github-modal-title">Hello World settings</p>
        <input
          className="github-modal-input"
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Enter a greeting…"
        />
        <button className="github-modal-btn-primary" onClick={handleSave} style={{ marginTop: 16 }}>Save</button>
        <button className="github-modal-btn-dismiss" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}
