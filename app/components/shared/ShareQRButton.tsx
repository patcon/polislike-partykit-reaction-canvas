import { useState } from "react";
import { Scanner } from "@yudiel/react-qr-scanner";
import { WebHaptics } from "web-haptics";
import { useWebHaptics } from "web-haptics/react";
import { appendSelfToChain } from "../../utils/inviteChain";
import QRWithCopy from "./QRWithCopy";

function getShareUrl(userId?: string, selfChain?: string[]): string {
  const p = new URLSearchParams(window.location.search);
  p.delete('forceView');
  p.delete('interface');
  p.delete('admin');
  if (userId && selfChain !== undefined) {
    p.set('inviteChain', appendSelfToChain(selfChain, userId).join(','));
  }
  const qs = p.toString();
  return `${window.location.origin}${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`;
}

interface ShareQRButtonProps {
  userId?: string;
  selfChain?: string[];
}

export default function ShareQRButton({ userId, selfChain }: ShareQRButtonProps = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'share' | 'scan'>('share');
  const [cameraState, setCameraState] = useState<'idle' | 'active' | 'error'>('idle');
  const [foreignDomain, setForeignDomain] = useState<string | null>(null);
  // Enable audio fallback on desktop (no touch) and Apple devices (no navigator.vibrate API)
  const { trigger: triggerHaptic } = useWebHaptics({ debug: navigator.maxTouchPoints === 0 || !WebHaptics.isSupported });
  const url = getShareUrl(userId, selfChain);

  const handleTabChange = (tab: 'share' | 'scan') => {
    setActiveTab(tab);
    setForeignDomain(null);
    if (tab === 'scan') {
      setCameraState('active');
    } else {
      setCameraState('idle');
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setActiveTab('share');
    setCameraState('idle');
    setForeignDomain(null);
  };

  const handleScanResult = (codes: { rawValue: string }[]) => {
    if (foreignDomain) return;
    const raw = codes[0]?.rawValue;
    if (!raw) return;
    let scanned: URL;
    try {
      scanned = new URL(raw);
      if (scanned.protocol !== 'http:' && scanned.protocol !== 'https:') return;
    } catch { return; }

    if (scanned.hostname !== window.location.hostname) {
      setForeignDomain(scanned.hostname);
      triggerHaptic('error');
      return;
    }

    triggerHaptic('nudge');

    const forceView = new URLSearchParams(window.location.search).get('forceView');
    if (forceView) scanned.searchParams.set('forceView', forceView);
    window.location.href = scanned.toString();
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
              <QRWithCopy url={url} qrClassName="share-qr-code-wrap" />
            )}
            {activeTab === 'scan' && (
              <>
                <div className="share-qr-scanner-wrap">
                  {cameraState === 'active' && (
                    <Scanner
                      onScan={handleScanResult}
                      onError={() => setCameraState('error')}
                      sound={false}
                      components={{ torch: false }}
                      styles={{ container: { width: '100%', borderRadius: 12 } }}
                    />
                  )}
                  {cameraState === 'error' && (
                    <div className="share-qr-foreign-warn">
                      <p className="share-qr-scan-error">Camera unavailable. Check permissions.</p>
                    </div>
                  )}
                </div>
                {foreignDomain ? (
                  <div className="qr-url-row">
                    <p className="share-qr-foreign-warn-text">scanned domain mismatch</p>
                    <button className="qr-copy-btn" onClick={() => setForeignDomain(null)} aria-label="Dismiss">✕</button>
                  </div>
                ) : (
                  <div className="qr-url-row" aria-hidden="true" />
                )}
              </>
            )}
            <button className="share-qr-modal-close" onClick={handleClose}>Close</button>
          </div>
        </div>
      )}
    </>
  );
}
