import { useState, useEffect } from "react";

const AVATAR_STYLES = [
  { id: 'adventurer', label: 'Adventurer' },
  { id: 'avataaars', label: 'Avataaars' },
  { id: 'bottts', label: 'Bottts (Robots)' },
  { id: 'fun-emoji', label: 'Fun Emoji' },
  { id: 'identicon', label: 'Identicon' },
  { id: 'lorelei', label: 'Lorelei' },
  { id: 'micah', label: 'Micah' },
  { id: 'open-peeps', label: 'Open Peeps' },
  { id: 'pixel-art', label: 'Pixel Art' },
  { id: 'thumbs', label: 'Thumbs' },
];

const VALENCE_COLORS = ['rgba(0,255,0,0.8)', 'rgba(255,0,0,0.8)', 'rgba(255,255,0,0.8)'];
const DOT_GREY = 'rgba(150,150,150,0.7)';

// avatarStyle encoding:
//   null            → dots, no custom overlay
//   'bottts'        → DiceBear bottts, no custom overlay
//   'custom'        → custom photos; dot fallback for unregistered users
//   'custom+bottts' → custom photos; DiceBear fallback for unregistered users
function parseAvatarStyle(avatarStyle: string | null): { isCustom: boolean; baseStyle: string | null } {
  if (avatarStyle === 'custom') return { isCustom: true, baseStyle: null };
  if (typeof avatarStyle === 'string' && avatarStyle.startsWith('custom+')) {
    return { isCustom: true, baseStyle: avatarStyle.slice(7) };
  }
  return { isCustom: false, baseStyle: avatarStyle };
}

function buildAvatarStyle(isCustom: boolean, baseStyle: string | null): string | null {
  if (!isCustom) return baseStyle;
  return baseStyle ? `custom+${baseStyle}` : 'custom';
}

interface AvatarsTabProps {
  avatarStyle: string | null;
  sendAvatarStyle: (style: string | null) => void;
  colorCursorsByVote: boolean;
  sendColorCursorsByVote: (enabled: boolean) => void;
}

export default function AvatarsTab({ avatarStyle, sendAvatarStyle, colorCursorsByVote, sendColorCursorsByVote }: AvatarsTabProps) {
  const { isCustom, baseStyle } = parseAvatarStyle(avatarStyle);

  const [valenceIdx, setValenceIdx] = useState(0);
  useEffect(() => {
    if (!colorCursorsByVote) return;
    const id = setInterval(() => setValenceIdx(i => (i + 1) % VALENCE_COLORS.length), 1000);
    return () => clearInterval(id);
  }, [colorCursorsByVote]);
  const valencePreviewColor = colorCursorsByVote ? VALENCE_COLORS[valenceIdx] : DOT_GREY;

  const handleCustomToggle = (checked: boolean) => {
    sendAvatarStyle(buildAvatarStyle(checked, baseStyle));
  };

  const handleBaseChange = (style: string | null) => {
    sendAvatarStyle(buildAvatarStyle(isCustom, style));
  };

  return (
    <div>
      <p style={{ marginBottom: 4, fontWeight: 600 }}>Avatar style (shown to all participants):</p>
      <p style={{ marginBottom: 16, color: '#888', fontSize: 13 }}>Avatars are generated from each user's ID using <a href="https://www.dicebear.com" target="_blank" rel="noopener noreferrer" style={{ color: '#69f' }}>DiceBear</a>.</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '10px 12px', background: '#1a1a1a', border: '1px solid #333', borderRadius: 8 }}>
          <input
            type="checkbox"
            checked={isCustom}
            onChange={e => handleCustomToggle(e.target.checked)}
            style={{ width: 16, height: 16, cursor: 'pointer', flexShrink: 0 }}
          />
          <span style={{ fontSize: 13 }}>
            <strong>Custom photos</strong> (e.g., Guild) — show scanned QR photos; fall back to style below
          </span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '10px 12px', background: '#1a1a1a', border: '1px solid #333', borderRadius: 8 }}>
          <input
            type="checkbox"
            checked={colorCursorsByVote}
            onChange={e => sendColorCursorsByVote(e.target.checked)}
            style={{ width: 16, height: 16, cursor: 'pointer', flexShrink: 0 }}
          />
          <span style={{ fontSize: 13 }}>
            <strong>Highlight valence</strong> when available — color cursors by reaction; grey otherwise
          </span>
        </label>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
          <input
            type="radio"
            name="avatarStyle"
            value=""
            checked={baseStyle === null}
            onChange={() => handleBaseChange(null)}
            style={{ marginRight: 4 }}
          />
          <div
            style={{ width: 36, height: 36, borderRadius: '50%', background: valencePreviewColor, border: '2px solid #555', flexShrink: 0, transition: 'none' }}
          />
          <span style={{ color: '#aaa' }}>None (colored dots)</span>
        </label>
        {AVATAR_STYLES.map(({ id, label }) => (
          <label key={id} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
            <input
              type="radio"
              name="avatarStyle"
              value={id}
              checked={baseStyle === id}
              onChange={() => handleBaseChange(id)}
              style={{ marginRight: 4 }}
            />
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: valencePreviewColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'none' }}>
              <img
                src={`https://api.dicebear.com/9.x/${id}/svg?seed=preview`}
                alt={label}
                width={36}
                height={36}
                style={{ borderRadius: '50%', display: 'block' }}
              />
            </div>
            <span>{label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
