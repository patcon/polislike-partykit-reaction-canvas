import { useState } from "react";

const DEFAULT_IMAGE_URL = 'https://pbs.twimg.com/media/DY_tjS0WsAADhmT.jpg';

interface ImageConfigModalProps {
  onSubmit: (url: string) => void;
  onClose: () => void;
  currentUrl?: string;
}

export default function ImageConfigModal({ onSubmit, onClose, currentUrl }: ImageConfigModalProps) {
  const [urlInput, setUrlInput] = useState(currentUrl ?? '');

  const handleSubmit = () => {
    onSubmit(urlInput.trim() || DEFAULT_IMAGE_URL);
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
        <input
          className="github-modal-input"
          type="url"
          value={urlInput}
          onChange={e => setUrlInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
          placeholder={DEFAULT_IMAGE_URL}
          autoFocus
        />
        <button className="github-modal-btn-primary" onClick={handleSubmit}>
          Set image
        </button>
        <button className="github-modal-btn-dismiss" onClick={handleClear}>Clear image</button>
        <button className="github-modal-btn-dismiss" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}
