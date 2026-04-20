import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";

function getShareUrl(): string {
  const p = new URLSearchParams(window.location.search);
  p.delete('forceView');
  const qs = p.toString();
  return `${window.location.origin}${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`;
}

export default function ShareQRButton() {
  const [isOpen, setIsOpen] = useState(false);
  const url = getShareUrl();

  return (
    <>
      <button className="share-qr-btn" onClick={() => setIsOpen(true)} aria-label="Share link">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
          <line x1="14" y1="17.5" x2="21" y2="17.5" /><line x1="17.5" y1="14" x2="17.5" y2="21" />
        </svg>
      </button>
      {isOpen && (
        <div className="share-qr-modal" onClick={() => setIsOpen(false)}>
          <div className="share-qr-modal-card" onClick={e => e.stopPropagation()}>
            <p className="share-qr-modal-title">Share this page</p>
            <div className="v2-mobile-gate-qr">
              <QRCodeSVG value={url} size={220} />
            </div>
            <p className="share-qr-modal-url">{url}</p>
            <button className="share-qr-modal-close" onClick={() => setIsOpen(false)}>Close</button>
          </div>
        </div>
      )}
    </>
  );
}
