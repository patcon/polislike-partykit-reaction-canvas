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
  action: 'open-url' | 'copy-then-open';
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
    label: 'Share on Instagram',
    action: 'copy-then-open',
    openUrl: 'https://www.instagram.com',
  },
];

export default function SocialPanel({ socialConfig }: SocialPanelProps) {
  const [copiedKey, setCopiedKey] = useState<PlatformKey | null>(null);

  const visiblePlatforms = socialConfig
    ? PLATFORMS.filter(p => buildPostText(socialConfig.default, socialConfig[p.key]).length > 0)
    : [];

  const handleClick = async (p: Platform) => {
    if (!socialConfig) return;
    const text = buildPostText(socialConfig.default, socialConfig[p.key]);

    if (p.action === 'copy-then-open') {
      try { await navigator.clipboard.writeText(text); } catch { /* clipboard unavailable on HTTP */ }
      setCopiedKey(p.key);
      setTimeout(() => setCopiedKey(null), 2000);
      window.open(p.openUrl, '_blank', 'noopener,noreferrer');
    } else {
      window.open(p.buildUrl!(text), '_blank', 'noopener,noreferrer');
    }
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
          <button
            key={p.key}
            onClick={() => handleClick(p)}
            style={{
              width: '100%',
              maxWidth: 320,
              padding: '14px 20px',
              background: '#1a1a1a',
              border: '1px solid #444',
              borderRadius: 8,
              color: '#eee',
              fontSize: 15,
              fontFamily: 'monospace',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            {copiedKey === p.key ? 'Copied! Opening Instagram…' : p.label}
          </button>
        ))
      )}
    </div>
  );
}
