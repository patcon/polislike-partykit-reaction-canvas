import type { SoccerScore } from './types';

interface SoccerConfigModalProps {
  score: SoccerScore;
  onReset: () => void;
  onClose: () => void;
}

export default function SoccerConfigModal({ score, onReset, onClose }: SoccerConfigModalProps) {
  return (
    <div className="github-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="github-modal">
        <p className="github-modal-title">Soccer settings</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 12 }}>
          <span style={{ color: '#aaa', fontSize: 15 }}>Score</span>
          <span style={{ fontFamily: 'monospace', fontSize: 22, fontWeight: 700, color: '#eee' }}>
            {score.left} – {score.right}
          </span>
        </div>
        <button className="v3-admin-btn v3-admin-btn--destructive" onClick={onReset}>
          Reset Score
        </button>
        <button className="github-modal-btn-dismiss" onClick={onClose} style={{ marginTop: 8 }}>
          Close
        </button>
      </div>
    </div>
  );
}
