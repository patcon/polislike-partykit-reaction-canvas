import { useState } from "react";

const DEFAULT_IMAGE_URL = 'https://pbs.twimg.com/media/DY_tjS0WsAADhmT.jpg';
const HISTORY_KEY = 'imageUrlHistory';
const MAX_HISTORY = 5;
const DEFAULT_THUMBNAILS = [
  'https://helpingwithmath.com/wp-content/uploads/2022/12/image-2.png',
  'https://images.squarespace-cdn.com/content/v1/5e8cca3f54b123010e2d5787/1638312025516-N24QWFTNAC7F0FT3KKUQ/Schwartz-Model-v4-Copyright.png?format=2500w',
  'https://i0.wp.com/upliftkids.org/wp-content/uploads/2022/04/Screen-Shot-2022-04-28-at-8.53.00-AM.png?w=1286&ssl=1',
];

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
  const thumbnails = [
    ...history,
    ...DEFAULT_THUMBNAILS.filter(u => !history.includes(u)),
  ].slice(0, MAX_HISTORY);
  const select = (url: string) => {
    setUrlInput(url);
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
        <div>
          <input
            className="github-modal-input"
            type="url"
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleSubmit();
            }}
            placeholder={DEFAULT_IMAGE_URL}
            autoFocus
          />
          {thumbnails.length > 0 && (
            <div style={{
              display: 'flex',
              gap: 8,
              overflowX: 'auto',
              marginTop: 8,
              paddingBottom: 4,
            }}>
              {thumbnails.map(url => (
                <button
                  key={url}
                  type="button"
                  onMouseDown={e => { e.preventDefault(); select(url); }}
                  style={{
                    padding: 0,
                    border: urlInput === url ? '2px solid #4a9eff' : '2px solid transparent',
                    borderRadius: 6,
                    background: 'none',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                  title={url}
                >
                  <img
                    src={url}
                    alt=""
                    style={{
                      width: 56,
                      height: 40,
                      objectFit: 'cover',
                      borderRadius: 4,
                      display: 'block',
                    }}
                  />
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
