import { useState, useRef } from "react";
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

// Short filtered noise burst — same technique as web-haptics desktop audio fallback.
// AudioContext must already be initialized (within a prior user gesture).
function playConfirmClick(ctx: AudioContext) {
  const duration = 0.004;
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / 25);
  }

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 3000 + Math.random() * 500;
  filter.Q.value = 8;

  const gain = ctx.createGain();
  gain.gain.value = 0.4;

  filter.connect(gain);
  gain.connect(ctx.destination);

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(filter);
  source.onended = () => source.disconnect();
  source.start();
}

interface ShareQRButtonProps {
  selfId?: string;
  selfChain?: string[];
}

export default function ShareQRButton({ selfId, selfChain }: ShareQRButtonProps = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'share' | 'scan'>('share');
  const [cameraState, setCameraState] = useState<'idle' | 'active' | 'error'>('idle');
  const [foreignDomain, setForeignDomain] = useState<string | null>(null);
  // Initialized within the Scan tab click gesture so it's unlocked for later playback
  const audioCtxRef = useRef<AudioContext | null>(null);
  const url = getShareUrl(selfId, selfChain);

  const handleTabChange = (tab: 'share' | 'scan') => {
    setActiveTab(tab);
    setForeignDomain(null);
    if (tab === 'scan') {
      setCameraState('active');
      // Initialize AudioContext within the user gesture so it's pre-unlocked for scan feedback
      if (!audioCtxRef.current && typeof AudioContext !== 'undefined') {
        audioCtxRef.current = new AudioContext();
      } else if (audioCtxRef.current?.state === 'suspended') {
        audioCtxRef.current.resume();
      }
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
    const raw = codes[0]?.rawValue;
    if (!raw) return;
    let scanned: URL;
    try {
      scanned = new URL(raw);
      if (scanned.protocol !== 'http:' && scanned.protocol !== 'https:') return;
    } catch { return; }

    if (scanned.hostname !== window.location.hostname) {
      setForeignDomain(scanned.hostname);
      return;
    }

    // Haptic on mobile; subtle click sound on desktop (web-haptics fallback technique)
    if (navigator.vibrate) {
      navigator.vibrate([50]);
    } else if (audioCtxRef.current) {
      playConfirmClick(audioCtxRef.current);
    }

    window.location.href = raw;
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
            {activeTab === 'scan' && (
              <div className="share-qr-scanner-wrap">
                {cameraState === 'active' && !foreignDomain && (
                  <Scanner
                    onScan={handleScanResult}
                    onError={() => setCameraState('error')}
                    sound={false}
                    styles={{ container: { width: '100%', borderRadius: 12 } }}
                  />
                )}
                {foreignDomain && (
                  <div className="share-qr-foreign-warn">
                    <p className="share-qr-foreign-warn-text">
                      This QR code points to a different site:
                    </p>
                    <p className="share-qr-foreign-warn-domain">{foreignDomain}</p>
                    <button
                      className="share-qr-modal-close"
                      onClick={() => setForeignDomain(null)}
                    >
                      Scan again
                    </button>
                  </div>
                )}
                {cameraState === 'error' && (
                  <div className="share-qr-foreign-warn">
                    <p className="share-qr-scan-error">Camera unavailable. Check permissions.</p>
                  </div>
                )}
              </div>
            )}
            <button className="share-qr-modal-close" onClick={handleClose}>Close</button>
          </div>
        </div>
      )}
    </>
  );
}
