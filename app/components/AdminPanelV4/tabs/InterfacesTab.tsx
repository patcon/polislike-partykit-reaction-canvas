import type { SocialConfig } from "../../../types";

interface InterfacesTabProps {
  activity: 'canvas' | 'soccer' | 'image-canvas';
  soccerScore: { left: number; right: number };
  sendActivity: (act: 'canvas' | 'soccer' | 'image-canvas') => void;
  resetSoccerScore: () => void;
  setImageConfigOpen: (v: boolean) => void;
  setSocialConfigOpen: (v: boolean) => void;
  triggerGithubActivity: () => void;
  onClearRoleAssignments: () => void;
}

export default function InterfacesTab({
  activity, soccerScore,
  sendActivity, resetSoccerScore,
  setImageConfigOpen, setSocialConfigOpen,
  triggerGithubActivity, onClearRoleAssignments,
}: InterfacesTabProps) {
  return (
    <div>
      <p style={{ marginBottom: 16, color: '#888', fontSize: 13 }}>All settings here are shared with all participants in real time.</p>
      <p style={{ marginBottom: 12, fontWeight: 600 }}>Interfaces</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {([
          { id: 'canvas', label: 'Reaction Canvas', desc: 'Standard reaction canvas' },
          { id: 'image-canvas', label: 'Image Canvas', desc: 'React over a shared background image' },
          { id: 'soccer', label: 'Soccer', desc: 'Top-down physics ball — kick with your cursor' },
        ] as const).map(({ id, label, desc }) => (
          <label key={id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
            <input
              type="radio"
              name="activity"
              value={id}
              checked={activity === id}
              onChange={() => sendActivity(id)}
              style={{ marginTop: 3 }}
            />
            <div>
              <span style={{ fontWeight: activity === id ? 600 : 400 }}>{label}</span>
              <span style={{ color: '#888', fontSize: 13, marginLeft: 8 }}>{desc}</span>
              {id === 'image-canvas' && (
                <button
                  className="image-canvas-config-link"
                  onClick={e => { e.preventDefault(); setImageConfigOpen(true); }}
                >
                  config
                </button>
              )}
            </div>
          </label>
        ))}
      </div>

      {activity === 'soccer' && (
        <div style={{ marginTop: 24, borderTop: '1px solid #444', paddingTop: 20 }}>
          <p style={{ marginBottom: 10, fontWeight: 600 }}>Soccer settings:</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 12 }}>
            <span style={{ color: '#aaa', fontSize: 15 }}>Score:</span>
            <span style={{ fontFamily: 'monospace', fontSize: 22, fontWeight: 700, color: '#eee' }}>
              {soccerScore.left} – {soccerScore.right}
            </span>
          </div>
          <button className="v3-admin-btn v3-admin-btn--destructive" onClick={resetSoccerScore}>
            Reset Score
          </button>
        </div>
      )}

      <div style={{ marginTop: 32, borderTop: '1px solid #444', paddingTop: 20 }}>
        <p style={{ marginBottom: 12, fontWeight: 600 }}>Social sharing</p>
        <p style={{ marginBottom: 12, color: '#888', fontSize: 13 }}>Configure prefilled text for participant share buttons. Participants with <code>?interface=social</code> see a button per platform.</p>
        <div style={{ background: '#222', border: '1px solid #444', borderRadius: 8, padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontWeight: 600, margin: '0 0 2px' }}>Social butterfly</p>
            <p style={{ color: '#888', fontSize: 13, margin: 0 }}>Bluesky · Twitter / X · Mastodon</p>
          </div>
          <button
            className="image-canvas-config-link"
            onClick={e => { e.preventDefault(); setSocialConfigOpen(true); }}
          >
            config
          </button>
        </div>
      </div>

      <div style={{ marginTop: 32, borderTop: '1px solid #444', paddingTop: 20 }}>
        <p style={{ marginBottom: 4, fontWeight: 600 }}>Role assignments</p>
        <p style={{ marginBottom: 16, color: '#888', fontSize: 13 }}>Push interface invitations to participants from the Participants tab. Use this to revoke all pushed roles.</p>
        <button className="v3-admin-btn v3-admin-btn--destructive" onClick={onClearRoleAssignments}>
          Clear all role assignments
        </button>
      </div>

      <div style={{ marginTop: 32, borderTop: '1px solid #444', paddingTop: 20 }}>
        <p style={{ marginBottom: 4, fontWeight: 600 }}>Popups</p>
        <p style={{ marginBottom: 16, color: '#888', fontSize: 13 }}>Push a one-time form to all participants. Submissions appear in the Events tab.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ background: '#222', border: '1px solid #444', borderRadius: 8, padding: '12px 14px' }}>
            <p style={{ fontWeight: 600, margin: '0 0 2px' }}>Coder role</p>
            <p style={{ color: '#888', fontSize: 13, margin: '0 0 10px' }}>Ask participants for their GitHub username to confirm they can contribute code.</p>
            <button className="v3-admin-btn" onClick={triggerGithubActivity}>
              Push popup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
