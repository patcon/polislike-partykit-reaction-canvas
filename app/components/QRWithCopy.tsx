import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";

interface QRWithCopyProps {
  url: string;
  size?: number;
  urlClassName?: string;
  qrClassName?: string;
}

export default function QRWithCopy({
  url,
  size = 220,
  urlClassName = 'share-qr-modal-url',
  qrClassName = 'v2-mobile-gate-qr',
}: QRWithCopyProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const el = document.createElement('textarea');
      el.value = url;
      el.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
      document.body.appendChild(el);
      el.focus();
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <div className={qrClassName}>
        <QRCodeSVG value={url} size={size} />
      </div>
      <div className="qr-url-row">
        <p className={urlClassName}>{url}</p>
        <button
          className={`qr-copy-btn${copied ? ' qr-copy-btn--copied' : ''}`}
          onClick={handleCopy}
          aria-label={copied ? "Copied!" : "Copy URL"}
          title={copied ? "Copied!" : "Copy URL"}
        >
          {copied ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          )}
        </button>
      </div>
    </>
  );
}
