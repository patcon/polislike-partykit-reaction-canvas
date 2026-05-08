import { useState } from "react";

interface FeedbackStarsModalProps {
  onSubmit: (stars: number) => void;
  onDismiss: () => void;
}

export default function FeedbackStarsModal({ onSubmit, onDismiss }: FeedbackStarsModalProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = () => {
    if (selected === null) return;
    onSubmit(selected);
    setDone(true);
  };

  const display = hovered ?? selected ?? -1;

  return (
    <div className="github-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onDismiss(); }}>
      <div className="github-modal">
        {!done ? (
          <>
            <p className="github-modal-title">How's it going?</p>
            <p className="github-modal-body">Rate your experience so far.</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, margin: '8px 0 16px' }}>
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  onClick={() => setSelected(star)}
                  onMouseEnter={() => setHovered(star)}
                  onMouseLeave={() => setHovered(null)}
                  style={{ fontSize: 32, background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1, color: star <= display ? '#f5c518' : '#555', transition: 'color 0.1s' }}
                >
                  ★
                </button>
              ))}
            </div>
            <button
              className="github-modal-btn-primary"
              onClick={handleSubmit}
              disabled={selected === null}
            >
              Submit
            </button>
            <button className="github-modal-btn-dismiss" onClick={onDismiss}>Not now</button>
          </>
        ) : (
          <>
            <p className="github-modal-title">Thanks!</p>
            <p className="github-modal-body">Your feedback has been shared with the emcee.</p>
            <button className="github-modal-btn-primary" onClick={onDismiss}>Close</button>
          </>
        )}
      </div>
    </div>
  );
}
