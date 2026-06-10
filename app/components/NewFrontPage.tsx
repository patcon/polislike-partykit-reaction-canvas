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
  const r = encodeURIComponent(room.trim().replace(/\s+/g, '-') || 'default');
  return `/${r}${emcee ? '?interface=emcee' : ''}`;
}

function buildExperimentUrl(type: 'youtube' | 'watch-party', videoId: string) {
  const id = encodeURIComponent(videoId || 'default');
  if (type === 'youtube') return `/${id}#v5`;
  return `/${id}#v2`;
}

type ExperimentType = 'youtube' | 'watch-party';

const VIDEO_PRESETS = [
  { id: 'irc6creOFGs' },
  { id: 'dQw4w9WgXcQ' },
  { id: 'jNQXAC9IVRw' },
];

const EXPERIMENTS: { value: ExperimentType; label: string; desc: string }[] = [
  {
    value: 'youtube',
    label: 'YouTube Videos',
    desc: 'React to pre-recorded videos. Past reactions replay in sync with the video timecode.',
  },
  {
    value: 'watch-party',
    label: "Sync'd YouTube Watch Party",
    desc: 'Video only plays when everyone is touching the screen.',
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
  const [activePreset, setActivePreset] = useState<number | null>(0);
  const urlInputRef = useRef<HTMLInputElement>(null);

  const effectiveVideoId = activePreset !== null
    ? VIDEO_PRESETS[activePreset].id
    : extractYouTubeId(youtubeUrl.trim());

  function handlePresetClick(i: number) {
    setActivePreset(i);
    setYoutubeUrl('');
  }

  function handleUrlChange(e: React.ChangeEvent<HTMLInputElement>) {
    setYoutubeUrl(e.target.value);
    setActivePreset(null);
  }

  function handleCustomPresetClick() {
    setActivePreset(null);
    setYoutubeUrl('');
    urlInputRef.current?.focus();
  }

  return (
    <div className="nfp-page">
      <div className="nfp-content">
        {/* Hero */}
        <div className="nfp-hero">
          <div className="nfp-icon" aria-hidden="true">〰️</div>
          <h1 className="nfp-title">Whisper Gallery</h1>
          <p className="nfp-tagline">see realtime audience reactions at live events</p>

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
            <a className="nfp-btn nfp-btn-primary" href={buildV4Url(room, false)}>
              Participant View
            </a>
            <a className="nfp-btn nfp-btn-secondary" href={buildV4Url(room, true)}>
              Emcee View
            </a>
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
                ref={urlInputRef}
                className="nfp-experiment-url-input"
                type="url"
                placeholder={activePreset !== null
                  ? `https://youtube.com/watch?v=${VIDEO_PRESETS[activePreset].id}`
                  : 'https://youtube.com/watch?v=...'}
                value={youtubeUrl}
                onChange={handleUrlChange}
              />
              <div className="nfp-video-presets">
                {VIDEO_PRESETS.map((preset, i) => (
                  <button
                    key={preset.id}
                    className={`nfp-video-preset ${activePreset === i ? 'nfp-video-preset--active' : ''}`}
                    onClick={() => handlePresetClick(i)}
                    type="button"
                  >
                    <img
                      src={`https://img.youtube.com/vi/${preset.id}/mqdefault.jpg`}
                      alt={`Video preset ${i + 1}`}
                    />
                  </button>
                ))}
                <button
                  className={`nfp-video-preset nfp-video-preset--custom ${activePreset === null ? 'nfp-video-preset--active' : ''}`}
                  onClick={handleCustomPresetClick}
                  type="button"
                >
                  any other video
                </button>
              </div>
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
              <a className="nfp-btn nfp-btn-primary" href={buildExperimentUrl(experimentType, effectiveVideoId)}>
                Open Experiment
              </a>
              {experimentType === 'youtube' && (
                <a className="nfp-admin-link" href="/default?admin=true#v5">
                  Admin
                </a>
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
