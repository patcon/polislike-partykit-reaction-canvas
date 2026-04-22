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

interface AvatarsTabProps {
  avatarStyle: string | null;
  sendAvatarStyle: (style: string | null) => void;
}

export default function AvatarsTab({ avatarStyle, sendAvatarStyle }: AvatarsTabProps) {
  return (
    <div>
      <p style={{ marginBottom: 4, fontWeight: 600 }}>Avatar style (shown to all participants):</p>
      <p style={{ marginBottom: 16, color: '#888', fontSize: 13 }}>Avatars are generated from each user's ID using <a href="https://www.dicebear.com" target="_blank" rel="noopener noreferrer" style={{ color: '#69f' }}>DiceBear</a>.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
          <input
            type="radio"
            name="avatarStyle"
            value=""
            checked={avatarStyle === null}
            onChange={() => sendAvatarStyle(null)}
            style={{ marginRight: 4 }}
          />
          <span style={{ color: '#aaa' }}>None (show colored dots)</span>
        </label>
        {AVATAR_STYLES.map(({ id, label }) => (
          <label key={id} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
            <input
              type="radio"
              name="avatarStyle"
              value={id}
              checked={avatarStyle === id}
              onChange={() => sendAvatarStyle(id)}
              style={{ marginRight: 4 }}
            />
            <img
              src={`https://api.dicebear.com/9.x/${id}/svg?seed=preview`}
              alt={label}
              width={36}
              height={36}
              style={{ borderRadius: '50%', border: '2px solid #555', background: '#222' }}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
