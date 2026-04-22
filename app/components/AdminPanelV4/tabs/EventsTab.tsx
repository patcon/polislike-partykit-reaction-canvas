import type { GithubSubmission } from "../types";

interface EventsTabProps {
  githubSubmissions: GithubSubmission[];
  setGithubSubmissions: (v: GithubSubmission[]) => void;
  downloadGithubSubmissions: () => void;
}

export default function EventsTab({ githubSubmissions, setGithubSubmissions, downloadGithubSubmissions }: EventsTabProps) {
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <p style={{ fontWeight: 600, margin: 0 }}>GitHub username submissions</p>
        <button
          className="v3-admin-btn"
          onClick={downloadGithubSubmissions}
          disabled={githubSubmissions.length === 0}
          style={{ marginLeft: 'auto' }}
        >
          ↓ Download JSON
        </button>
        <button
          className="v3-admin-btn v3-admin-btn--destructive"
          onClick={() => setGithubSubmissions([])}
          disabled={githubSubmissions.length === 0}
        >
          ✕ Clear
        </button>
      </div>
      {githubSubmissions.length === 0 ? (
        <p style={{ color: '#666', fontSize: 13 }}>No submissions yet. Trigger the activity from the Interface tab.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: 'monospace' }}>
            <thead>
              <tr style={{ background: '#222', color: '#aaa', textAlign: 'left' }}>
                <th style={{ padding: '6px 10px', borderBottom: '1px solid #444' }}>#</th>
                <th style={{ padding: '6px 10px', borderBottom: '1px solid #444' }}>time</th>
                <th style={{ padding: '6px 10px', borderBottom: '1px solid #444' }}>avatar</th>
                <th style={{ padding: '6px 10px', borderBottom: '1px solid #444' }}>username</th>
                <th style={{ padding: '6px 10px', borderBottom: '1px solid #444' }}>display name</th>
              </tr>
            </thead>
            <tbody>
              {githubSubmissions.map((s, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? '#1a1a1a' : '#111' }}>
                  <td style={{ padding: '4px 10px', color: '#555' }}>{i + 1}</td>
                  <td style={{ padding: '4px 10px', color: '#888' }}>
                    {new Date(s.timestamp).toISOString().slice(11, 19)}
                  </td>
                  <td style={{ padding: '4px 10px' }}>
                    {s.avatarUrl && (
                      <img src={s.avatarUrl} alt={s.username} width={24} height={24} style={{ borderRadius: '50%', verticalAlign: 'middle' }} />
                    )}
                  </td>
                  <td style={{ padding: '4px 10px', color: '#9cf' }}>
                    <a href={`https://github.com/${s.username}`} target="_blank" rel="noopener noreferrer" style={{ color: '#9cf' }}>
                      @{s.username}
                    </a>
                  </td>
                  <td style={{ padding: '4px 10px', color: '#ccc' }}>{s.displayName ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
