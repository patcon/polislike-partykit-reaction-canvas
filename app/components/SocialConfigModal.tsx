import { useState } from "react";
import type { SocialConfig } from "../types";

interface SocialConfigModalProps {
  onSubmit: (config: SocialConfig) => void;
  onClose: () => void;
  current?: SocialConfig | null;
}

export default function SocialConfigModal({ onSubmit, onClose, current }: SocialConfigModalProps) {
  const [defaultText, setDefaultText] = useState(current?.default ?? '');
  const [twitter, setTwitter] = useState(current?.twitter ?? '');
  const [bluesky, setBluesky] = useState(current?.bluesky ?? '');
  const [mastodon, setMastodon] = useState(current?.mastodon ?? '');

  const handleSave = () => {
    onSubmit({ default: defaultText, twitter, bluesky, mastodon });
    onClose();
  };

  return (
    <div className="github-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="github-modal">
        <p className="github-modal-title">Social sharing config</p>
        <p className="github-modal-body">Set the prefilled text for each platform. Fields are joined with a space. Leave a field empty to hide that platform's button.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 12, color: '#aaa' }}>Default (all platforms)</span>
            <input
              className="github-modal-input"
              type="text"
              value={defaultText}
              onChange={e => setDefaultText(e.target.value)}
              placeholder="some text and #hashtag"
              autoFocus
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 12, color: '#aaa' }}>Twitter / X</span>
            <input
              className="github-modal-input"
              type="text"
              value={twitter}
              onChange={e => setTwitter(e.target.value)}
              placeholder="@handle"
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 12, color: '#aaa' }}>Bluesky</span>
            <input
              className="github-modal-input"
              type="text"
              value={bluesky}
              onChange={e => setBluesky(e.target.value)}
              placeholder="@handle"
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 12, color: '#aaa' }}>Mastodon</span>
            <input
              className="github-modal-input"
              type="text"
              value={mastodon}
              onChange={e => setMastodon(e.target.value)}
              placeholder="@handle@instance"
            />
          </label>
        </div>
        <button className="github-modal-btn-primary" onClick={handleSave} style={{ marginTop: 16 }}>
          Save
        </button>
        <button className="github-modal-btn-dismiss" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}
