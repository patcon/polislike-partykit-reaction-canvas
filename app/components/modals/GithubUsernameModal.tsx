import { useState } from "react";

interface GithubUser {
  login: string;
  name: string | null;
  avatar_url: string;
}

interface GithubUsernameModalProps {
  onSubmit: (username: string, displayName: string | null, avatarUrl: string | null) => void;
  onDismiss: () => void;
}

export default function GithubUsernameModal({ onSubmit, onDismiss }: GithubUsernameModalProps) {
  const [step, setStep] = useState<'prompt' | 'input' | 'confirm' | 'done'>('prompt');
  const [usernameInput, setUsernameInput] = useState('');
  const [resolvedUser, setResolvedUser] = useState<GithubUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const lookupUsername = async () => {
    const username = usernameInput.trim();
    if (!username) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}`);
      if (res.status === 404) {
        setError('GitHub user not found. Check the username and try again.');
        setLoading(false);
        return;
      }
      if (!res.ok) {
        setError('Could not reach GitHub. Try again.');
        setLoading(false);
        return;
      }
      const data: GithubUser = await res.json();
      setResolvedUser(data);
      setStep('confirm');
    } catch {
      setError('Network error. Try again.');
    }
    setLoading(false);
  };

  const handleConfirm = () => {
    if (!resolvedUser) return;
    onSubmit(resolvedUser.login, resolvedUser.name, resolvedUser.avatar_url);
    setStep('done');
  };

  return (
    <div className="app-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onDismiss(); }}>
      <div className="app-modal">
        {step === 'prompt' && (
          <>
            <p className="app-modal-title">Seeking [vibe] coders</p>
            <p className="app-modal-body">Do you have your laptop? Willing to help improve the system running this event?</p>
            <button className="app-modal-btn-primary" onClick={() => setStep('input')}>
              Share your GitHub handle
            </button>
            <button className="app-modal-btn-dismiss" onClick={onDismiss}>Not now</button>
          </>
        )}

        {step === 'input' && (
          <>
            <p className="app-modal-title">Enter your GitHub username</p>
            <input
              className="app-modal-input"
              type="text"
              value={usernameInput}
              onChange={e => { setUsernameInput(e.target.value); setError(null); }}
              onKeyDown={e => { if (e.key === 'Enter') lookupUsername(); }}
              placeholder="username"
              autoFocus
              autoCapitalize="none"
              autoCorrect="off"
            />
            {error && <p className="app-modal-error">{error}</p>}
            <button
              className="app-modal-btn-primary"
              onClick={lookupUsername}
              disabled={loading || !usernameInput.trim()}
            >
              {loading ? 'Checking…' : 'Verify'}
            </button>
            <button className="app-modal-btn-dismiss" onClick={() => setStep('prompt')}>Back</button>
          </>
        )}

        {step === 'confirm' && resolvedUser && (
          <>
            <p className="app-modal-title">Is this you?</p>
            <div className="app-modal-user-card">
              <img
                src={resolvedUser.avatar_url}
                alt={resolvedUser.login}
                className="app-modal-avatar"
              />
              <div>
                <p className="app-modal-display-name">{resolvedUser.name || resolvedUser.login}</p>
                <p className="app-modal-login">@{resolvedUser.login}</p>
              </div>
            </div>
            <button className="app-modal-btn-primary" onClick={handleConfirm}>
              Yes, that's me
            </button>
            <button className="app-modal-btn-dismiss" onClick={() => { setStep('input'); setResolvedUser(null); }}>
              Not me
            </button>
          </>
        )}

        {step === 'done' && (
          <>
            <p className="app-modal-title">Thanks!</p>
            <p className="app-modal-body">Your GitHub username has been shared with the emcee.</p>
            <button className="app-modal-btn-primary" onClick={onDismiss}>Close</button>
          </>
        )}
      </div>
    </div>
  );
}
