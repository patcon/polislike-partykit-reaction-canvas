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
  label: string;
  action: 'open-url' | 'copy-and-open';
  buildUrl?: (text: string) => string;
  openUrl?: string;
}

const PLATFORMS: Platform[] = [
  {
    key: 'twitter',
    label: 'Post to Twitter / X',
    action: 'open-url',
    buildUrl: text => `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,
  },
  {
    key: 'bluesky',
    label: 'Post to Bluesky',
    action: 'open-url',
    buildUrl: text => `https://bsky.app/intent/compose?text=${encodeURIComponent(text)}`,
  },
  {
    key: 'mastodon',
    label: 'Share on Mastodon',
    action: 'open-url',
    buildUrl: text => `https://mastodonshare.com/?text=${encodeURIComponent(text)}`,
  },
  {
    key: 'instagram',
    label: 'Instagram',
    action: 'copy-and-open',
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

export default function SocialPanel({ socialConfig }: SocialPanelProps) {
  const [copiedKey, setCopiedKey] = useState<PlatformKey | null>(null);

  const visiblePlatforms = socialConfig
    ? PLATFORMS.filter(p => buildPostText(socialConfig.default, socialConfig[p.key]).length > 0)
    : [];

  const handleOpen = (p: Platform) => {
    if (!socialConfig) return;
    const text = buildPostText(socialConfig.default, socialConfig[p.key]);
    window.open(p.action === 'open-url' ? p.buildUrl!(text) : p.openUrl, '_blank', 'noopener,noreferrer');
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
          p.action === 'copy-and-open' ? (
            <div key={p.key} style={{ width: '100%', maxWidth: 320, display: 'flex', gap: 8 }}>
              <button onClick={() => handleCopy(p)} style={{ ...BTN, flex: 1 }}>
                {copiedKey === p.key ? 'Copied!' : `Copy ${p.label} text`}
              </button>
              <button onClick={() => handleOpen(p)} style={{ ...BTN, flex: 1 }}>
                Open {p.label}
              </button>
            </div>
          ) : (
            <button
              key={p.key}
              onClick={() => handleOpen(p)}
              style={{ ...BTN, width: '100%', maxWidth: 320 }}
            >
              {p.label}
            </button>
          )
        ))
      )}
    </div>
  );
}
