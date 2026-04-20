import { useState } from "react";

const DEFAULT_IMAGE_URL = 'https://pbs.twimg.com/media/DY_tjS0WsAADhmT.jpg';

interface ImageConfigModalProps {
  onSubmit: (url: string) => void;
  onClose: () => void;
  currentUrl?: string;
}

export default function ImageConfigModal({ onSubmit, onClose, currentUrl }: ImageConfigModalProps) {
  const [urlInput, setUrlInput] = useState(currentUrl ?? DEFAULT_IMAGE_URL);

  const handleSubmit = () => {
    const url = urlInput.trim();
    if (url) onSubmit(url);
    onClose();
  };

  const handleClear = () => {
    onSubmit('');
    onClose();
  };

  return (
    <div className="github-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="github-modal">
        <p className="github-modal-title">Image Canvas</p>
        <p className="github-modal-body">Enter a public image URL to display as the canvas background. All participants will see the same image.</p>
        <div style={{ position: 'relative' }}>
          <input
            className="github-modal-input"
            type="url"
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
            placeholder="https://example.com/image.jpg"
            style={{ paddingRight: urlInput ? 32 : undefined }}
            autoFocus
          />
          {urlInput && (
            <button
              onClick={() => setUrlInput('')}
              style={{
                position: 'absolute',
                right: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: '#888',
                fontSize: 16,
                cursor: 'pointer',
                lineHeight: 1,
                padding: '0 2px',
              }}
              aria-label="Clear"
            >
              ×
            </button>
          )}
        </div>
        <button className="github-modal-btn-primary" onClick={handleSubmit} disabled={!urlInput.trim()}>
          Set image
        </button>
        {currentUrl && (
          <button className="github-modal-btn-dismiss" onClick={handleClear}>Clear image</button>
        )}
        <button className="github-modal-btn-dismiss" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}
