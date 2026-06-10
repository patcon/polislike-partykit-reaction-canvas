import { useState, useEffect, useRef } from 'react';

const ROOM_SUGGESTIONS = [
  'amber-dolphin',
  'brave-forest',
  'quiet-river',
  'silver-hawk',
  'gentle-tide',
  'swift-canyon',
  'golden-heron',
  'misty-pine',
  'coral-breeze',
  'indigo-sparrow',
  'verdant-cove',
  'azure-meadow',
];

function useTypewriter(words: string[]) {
  const [display, setDisplay] = useState('');
  const indexRef = useRef(0);
  const charRef = useRef(0);
  const deletingRef = useRef(false);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;

    function tick() {
      const word = words[indexRef.current];

      if (!deletingRef.current) {
        if (charRef.current < word.length) {
          charRef.current++;
          setDisplay(word.slice(0, charRef.current));
          timeout = setTimeout(tick, 80);
        } else {
          deletingRef.current = true;
          timeout = setTimeout(tick, 1500);
        }
      } else {
        if (charRef.current > 0) {
          charRef.current--;
          setDisplay(word.slice(0, charRef.current));
          timeout = setTimeout(tick, 40);
        } else {
          deletingRef.current = false;
          indexRef.current = (indexRef.current + 1) % words.length;
          timeout = setTimeout(tick, 300);
        }
      }
    }

    timeout = setTimeout(tick, 800);
    return () => clearTimeout(timeout);
  }, [words]);

  return display;
}

function extractYouTubeId(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname === 'youtu.be') return u.pathname.slice(1).split('?')[0];
    if (u.pathname.includes('/shorts/')) return u.pathname.split('/shorts/')[1].split('?')[0];
    return u.searchParams.get('v') ?? url;
  } catch {
    return url;
  }
}

function buildV4Url(room: string, emcee: boolean) {
  const r = room.trim().replace(/\s+/g, '-') || 'default';
  return `#v4?room=${encodeURIComponent(r)}${emcee ? '&interface=emcee' : ''}`;
}

function buildExperimentUrl(type: 'youtube' | 'watch-party', videoInput: string) {
  const id = extractYouTubeId(videoInput.trim()) || 'default';
  if (type === 'youtube') return `#v5?room=${encodeURIComponent(id)}`;
  return `#v2?room=${encodeURIComponent(id)}`;
}

type ExperimentType = 'youtube' | 'watch-party';

const EXPERIMENTS: { value: ExperimentType; label: string; desc: string }[] = [
  {
    value: 'youtube',
    label: 'YouTube Videos',
    desc: 'React to pre-recorded videos. Past reactions replay in sync with the video timecode.',
  },
  {
    value: 'watch-party',
    label: "Sync'd YouTube Watch Party",
    desc: 'Watch together in real time. Reactions appear live as cursors overlaid on the video.',
  },
];

const PROTOTYPES: { label: string; href: string; desc: string }[] = [
  {
    label: 'Valence Visualizer V2',
    href: '/valence-onboarding-v2.html',
    desc: 'Guided onboarding into a wave-form visualization of live audience sentiment.',
  },
  {
    label: 'Valence Visualizer V1',
    href: '#valence-viz',
    desc: '3D particle visualization of audience sentiment. Synthetic demo by default.',
  },
  {
    label: 'Valence Tones',
    href: '/mood-sounds.html',
    desc: 'Ambient generative sound driven by live cursor positions across the canvas.',
  },
];

export function NewFrontPage() {
  const [room, setRoom] = useState('');
  const typewriterText = useTypewriter(ROOM_SUGGESTIONS);

  const [experimentType, setExperimentType] = useState<ExperimentType>('youtube');
  const [youtubeUrl, setYoutubeUrl] = useState('');

  function handleOpen(emcee: boolean) {
    window.location.href = buildV4Url(room, emcee);
  }

  function handleOpenExperiment() {
    window.location.href = buildExperimentUrl(experimentType, youtubeUrl);
  }

  function handleOpenV5Admin() {
    window.location.href = '#v5?admin=true';
  }

  return (
    <div className="nfp-page">
      <div className="nfp-content">
        {/* Hero */}
        <div className="nfp-hero">
          <div className="nfp-icon" aria-hidden="true">〰️</div>
          <h1 className="nfp-title">Whisper Gallery</h1>
          <p className="nfp-tagline">see live reactions from the audience</p>

          <div className="nfp-room-field">
            <label className="nfp-room-label" htmlFor="nfp-room-input">Room name</label>
            <input
              id="nfp-room-input"
              className="nfp-room-input"
              type="text"
              value={room}
              onChange={e => setRoom(e.target.value)}
              placeholder={typewriterText}
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          <div className="nfp-actions">
            <span className="nfp-open-label">Open:</span>
            <button className="nfp-btn nfp-btn-primary" onClick={() => handleOpen(false)}>
              Participant View
            </button>
            <button className="nfp-btn nfp-btn-secondary" onClick={() => handleOpen(true)}>
              Emcee View
            </button>
          </div>
        </div>

        {/* Experiments */}
        <section className="nfp-section">
          <h2 className="nfp-section-title">Experiments</h2>
          <p className="nfp-section-desc">Potential variants of the UI in prototype form.</p>

          <div className="nfp-experiment-card">
            <div className="nfp-experiment-url-row">
              <label className="nfp-room-label" htmlFor="nfp-yt-url">YouTube URL</label>
              <input
                id="nfp-yt-url"
                className="nfp-experiment-url-input"
                type="url"
                placeholder="https://youtube.com/watch?v=..."
                value={youtubeUrl}
                onChange={e => setYoutubeUrl(e.target.value)}
              />
            </div>

            <div className="nfp-experiment-options">
              {EXPERIMENTS.map(exp => (
                <label
                  key={exp.value}
                  className={`nfp-experiment-option ${experimentType === exp.value ? 'nfp-experiment-option--active' : ''}`}
                >
                  <input
                    type="radio"
                    name="experiment"
                    value={exp.value}
                    checked={experimentType === exp.value}
                    onChange={() => setExperimentType(exp.value)}
                  />
                  <div className="nfp-experiment-option-text">
                    <span className="nfp-experiment-option-label">{exp.label}</span>
                    <span className="nfp-experiment-option-desc">{exp.desc}</span>
                  </div>
                </label>
              ))}
            </div>

            <div className="nfp-experiment-footer">
              <button className="nfp-btn nfp-btn-primary" onClick={handleOpenExperiment}>
                Open Experiment
              </button>
              {experimentType === 'youtube' && (
                <button className="nfp-admin-link" onClick={handleOpenV5Admin}>
                  Admin
                </button>
              )}
            </div>
          </div>
        </section>

        {/* More Prototypes */}
        <section className="nfp-section nfp-section--prototypes">
          <h2 className="nfp-section-title">More Prototypes</h2>
          <ul className="nfp-proto-list">
            {PROTOTYPES.map(p => (
              <li key={p.href}>
                <a className="nfp-proto-link" href={p.href}>{p.label}</a>
                <p className="nfp-proto-desc">{p.desc}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
