import { useState, useEffect } from 'react';
import { useAdminSocket } from '../../app/components/panels/AdminPanelNoDB/AdminSocketContext';
import type { SoccerScore } from './types';

export default function SoccerConfigModal({ onClose }: { onClose: () => void }) {
  const { send, subscribe, getLastMessage } = useAdminSocket();

  const [score, setScore] = useState<SoccerScore>(() => {
    const connected = getLastMessage('connected');
    return (connected?.soccerScore as SoccerScore) ?? { left: 0, right: 0 };
  });

  useEffect(() => {
    return subscribe(data => {
      if (data.type === 'goalScored') setScore(data.score as SoccerScore);
    });
  }, [subscribe]);

  const handleReset = () => send({ type: 'resetSoccerScore' });

  return (
    <div className="app-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="app-modal">
        <p className="app-modal-title">Soccer settings</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 12 }}>
          <span style={{ color: '#aaa', fontSize: 15 }}>Score</span>
          <span style={{ fontFamily: 'monospace', fontSize: 22, fontWeight: 700, color: '#eee' }}>
            {score.left} – {score.right}
          </span>
        </div>
        <button className="v3-admin-btn v3-admin-btn--destructive" onClick={handleReset}>
          Reset Score
        </button>
        <button className="app-modal-btn-dismiss" onClick={onClose} style={{ marginTop: 8 }}>
          Close
        </button>
      </div>
    </div>
  );
}
