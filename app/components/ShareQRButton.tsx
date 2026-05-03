import { useState } from "react";
import { Scanner } from "@yudiel/react-qr-scanner";
import { appendSelfToChain } from "../utils/inviteChain";
import QRWithCopy from "./QRWithCopy";

function getShareUrl(selfId?: string, selfChain?: string[]): string {
  const p = new URLSearchParams(window.location.search);
  p.delete('forceView');
  p.delete('interface');
  p.delete('admin');
  if (selfId && selfChain !== undefined) {
    p.set('inviteChain', appendSelfToChain(selfChain, selfId).join(','));
  }
  const qs = p.toString();
  return `${window.location.origin}${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`;
}

interface ShareQRButtonProps {
  selfId?: string;
  selfChain?: string[];
}

export default function ShareQRButton({ selfId, selfChain }: ShareQRButtonProps = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'share' | 'scan'>('share');
  const [cameraState, setCameraState] = useState<'idle' | 'active' | 'error'>('idle');
  const url = getShareUrl(selfId, selfChain);

  const handleTabChange = (tab: 'share' | 'scan') => {
    setActiveTab(tab);
    setCameraState(tab === 'scan' ? 'active' : 'idle');
  };

  const handleClose = () => {
    setIsOpen(false);
    setActiveTab('share');
    setCameraState('idle');
  };

  const handleScanResult = (codes: { rawValue: string }[]) => {
    const raw = codes[0]?.rawValue;
    if (!raw) return;
    try {
      const scanned = new URL(raw);
      if (scanned.protocol === 'http:' || scanned.protocol === 'https:') {
        window.location.href = raw;
      }
    } catch { /* not a URL */ }
  };

  return (
    <>
      <button className="share-qr-btn" onClick={() => setIsOpen(true)} aria-label="Share link">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
          <line x1="14" y1="17.5" x2="21" y2="17.5" /><line x1="17.5" y1="14" x2="17.5" y2="21" />
        </svg>
      </button>
      {isOpen && (
        <div className="share-qr-modal" onClick={handleClose}>
          <div className="share-qr-modal-card" onClick={e => e.stopPropagation()}>
            <p className="share-qr-modal-title">
              {activeTab === 'share' ? 'Share this page' : 'Scan QR Code'}
            </p>
            <div className="share-qr-tab-bar">
              <button
                className={`share-qr-tab-btn${activeTab === 'share' ? ' share-qr-tab-btn--active' : ''}`}
                onClick={() => handleTabChange('share')}
              >
                Share
              </button>
              <button
                className={`share-qr-tab-btn${activeTab === 'scan' ? ' share-qr-tab-btn--active' : ''}`}
                onClick={() => handleTabChange('scan')}
              >
                Scan
              </button>
            </div>
            {activeTab === 'share' && (
              <QRWithCopy url={url} />
            )}
            {activeTab === 'scan' && cameraState === 'active' && (
              <div className="share-qr-scanner-wrap">
                <Scanner
                  onScan={handleScanResult}
                  onError={() => setCameraState('error')}
                  styles={{ container: { width: '100%', borderRadius: 12 } }}
                />
              </div>
            )}
            {activeTab === 'scan' && cameraState === 'error' && (
              <p className="share-qr-scan-error">Camera unavailable. Check permissions.</p>
            )}
            <button className="share-qr-modal-close" onClick={handleClose}>Close</button>
          </div>
        </div>
      )}
    </>
  );
}
