import type { SocialConfig } from "../types";

interface SocialPanelProps {
  socialConfig: SocialConfig | null;
}

function buildPostText(defaultText: string, platformText: string): string {
  return [defaultText.trim(), platformText.trim()].filter(Boolean).join(' ');
}

export default function SocialPanel({ socialConfig }: SocialPanelProps) {
  const platforms: { key: keyof Omit<SocialConfig, 'default'>; label: string; buildUrl: (text: string) => string }[] = [
    {
      key: 'twitter',
      label: 'Post to Twitter / X',
      buildUrl: text => `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,
    },
    {
      key: 'bluesky',
      label: 'Post to Bluesky',
      buildUrl: text => `https://bsky.app/intent/compose?text=${encodeURIComponent(text)}`,
    },
    {
      key: 'mastodon',
      label: 'Share on Mastodon',
      buildUrl: text => `https://mastodonshare.com/?text=${encodeURIComponent(text)}`,
    },
  ];

  const visiblePlatforms = socialConfig
    ? platforms.filter(p => {
        const text = buildPostText(socialConfig.default, socialConfig[p.key]);
        return text.length > 0;
      })
    : [];

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
        visiblePlatforms.map(p => {
          const text = buildPostText(socialConfig!.default, socialConfig![p.key]);
          return (
            <button
              key={p.key}
              onClick={() => window.open(p.buildUrl(text), '_blank', 'noopener,noreferrer')}
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
              {p.label}
            </button>
          );
        })
      )}
    </div>
  );
}
