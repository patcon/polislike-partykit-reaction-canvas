import { useState, useRef } from "react";

const DEFAULT_IMAGE_URL = 'https://pbs.twimg.com/media/DY_tjS0WsAADhmT.jpg';
const HISTORY_KEY = 'imageUrlHistory';
const MAX_HISTORY = 5;

function getImageUrlHistory(): string[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]'); } catch { return []; }
}

function saveImageUrlToHistory(url: string): void {
  const history = [url, ...getImageUrlHistory().filter(u => u !== url)].slice(0, MAX_HISTORY);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

interface ImageConfigModalProps {
  onSubmit: (url: string) => void;
  onClose: () => void;
  currentUrl?: string;
}

export default function ImageConfigModal({ onSubmit, onClose, currentUrl }: ImageConfigModalProps) {
  const [urlInput, setUrlInput] = useState(currentUrl ?? '');
  const [history] = useState<string[]>(getImageUrlHistory);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = history.filter(u =>
    !urlInput || u.toLowerCase().includes(urlInput.toLowerCase())
  );
  const showDropdown = dropdownOpen && filtered.length > 0;

  const select = (url: string) => {
    setUrlInput(url);
    setDropdownOpen(false);
    inputRef.current?.blur();
  };

  const handleSubmit = () => {
    const url = urlInput.trim() || DEFAULT_IMAGE_URL;
    saveImageUrlToHistory(url);
    onSubmit(url);
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
            ref={inputRef}
            className="github-modal-input"
            type="url"
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            onFocus={() => setDropdownOpen(true)}
            onBlur={() => setTimeout(() => setDropdownOpen(false), 150)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleSubmit();
              if (e.key === 'Escape') setDropdownOpen(false);
            }}
            placeholder={DEFAULT_IMAGE_URL}
            autoFocus
          />
          {showDropdown && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              marginTop: 4,
              background: '#111',
              border: '1px solid #444',
              borderRadius: 8,
              boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
              zIndex: 10,
              maxHeight: 200,
              overflowY: 'auto',
            }}>
              {filtered.map(url => (
                <button
                  key={url}
                  type="button"
                  onMouseDown={e => { e.preventDefault(); select(url); }}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px 12px',
                    background: 'none',
                    border: 'none',
                    color: '#ccc',
                    fontSize: 12,
                    fontFamily: 'monospace',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    borderBottom: '1px solid #2a2a2a',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#222')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  {url}
                </button>
              ))}
            </div>
          )}
        </div>
        <button className="github-modal-btn-primary" onClick={handleSubmit}>
          Set image
        </button>
        <button className="github-modal-btn-dismiss" onClick={handleClear}>Clear image</button>
        <button className="github-modal-btn-dismiss" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}
