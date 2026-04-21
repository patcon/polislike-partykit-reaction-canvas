import { useState } from "react";
import type { SocialConfig } from "../types";

interface SocialPanelProps {
  socialConfig: SocialConfig | null;
}

function buildPostText(defaultText: string, platformText: string): string {
  return [defaultText.trim(), platformText.trim()].filter(Boolean).join(' ');
}

type PlatformKey = keyof Omit<SocialConfig, 'default'>;

interface Platform {
  key: PlatformKey;
  mainLabel: string;
  buildUrl?: (text: string) => string;
  openUrl?: string;
}

const PLATFORMS: Platform[] = [
  {
    key: 'twitter',
    mainLabel: 'Share to Twitter / X',
    buildUrl: text => `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,
  },
  {
    key: 'bluesky',
    mainLabel: 'Share to Bluesky',
    buildUrl: text => `https://bsky.app/intent/compose?text=${encodeURIComponent(text)}`,
  },
  {
    key: 'mastodon',
    mainLabel: 'Share on Mastodon',
    buildUrl: text => `https://mastodonshare.com/?text=${encodeURIComponent(text)}`,
  },
  {
    key: 'instagram',
    mainLabel: 'Open Instagram',
    openUrl: 'https://www.instagram.com',
  },
];

const BTN: React.CSSProperties = {
  padding: '14px 20px',
  background: '#1a1a1a',
  border: '1px solid #444',
  borderRadius: 8,
  color: '#eee',
  fontSize: 15,
  fontFamily: 'monospace',
  cursor: 'pointer',
  textAlign: 'left',
};

const COPY_BTN: React.CSSProperties = {
  ...BTN,
  padding: '14px 16px',
  flexShrink: 0,
  textAlign: 'center',
  fontSize: 18,
  color: '#888',
};

export default function SocialPanel({ socialConfig }: SocialPanelProps) {
  const [copiedKey, setCopiedKey] = useState<PlatformKey | null>(null);

  const visiblePlatforms = socialConfig
    ? PLATFORMS.filter(p => buildPostText(socialConfig.default, socialConfig[p.key]).length > 0)
    : [];

  const handleOpen = (p: Platform) => {
    if (!socialConfig) return;
    const text = buildPostText(socialConfig.default, socialConfig[p.key]);
    const url = p.buildUrl ? p.buildUrl(text) : p.openUrl!;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleCopy = async (p: Platform) => {
    if (!socialConfig) return;
    const text = buildPostText(socialConfig.default, socialConfig[p.key]);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for iOS Safari and HTTP contexts
      const el = document.createElement('textarea');
      el.value = text;
      el.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
      document.body.appendChild(el);
      el.focus();
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopiedKey(p.key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
      padding: 24,
      background: '#0f0f0e',
      color: '#ccc',
      fontFamily: 'monospace',
    }}>
      {visiblePlatforms.length === 0 ? (
        <p style={{ color: '#555', fontSize: 14 }}>No social sharing links configured yet.</p>
      ) : (
        visiblePlatforms.map(p => (
          <div key={p.key} style={{ width: '100%', maxWidth: 320, display: 'flex', gap: 8 }}>
            <button onClick={() => handleOpen(p)} style={{ ...BTN, flex: 1 }}>
              {p.mainLabel}
            </button>
            <button
              onClick={() => handleCopy(p)}
              style={{ ...COPY_BTN, color: copiedKey === p.key ? '#6f6' : '#888' }}
              title="Copy post text"
            >
              {copiedKey === p.key ? '✓' : '⎘'}
            </button>
          </div>
        ))
      )}
    </div>
  );
}
