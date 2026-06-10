import { useState, useEffect, useRef } from 'react';
import { REACTION_LABEL_PRESETS } from '../voteLabels';

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

function buildExperimentUrl(type: 'youtube' | 'watch-party', videoInput: string, style: string) {
  const id = extractYouTubeId(videoInput.trim()) || 'default';
  const labelParam = style !== 'default' ? `&labels=${encodeURIComponent(style)}` : '';
  if (type === 'youtube') return `#v5?room=${encodeURIComponent(id)}${labelParam}`;
  return `#v2?room=${encodeURIComponent(id)}${labelParam}`;
}

const PRESET_KEYS = Object.keys(REACTION_LABEL_PRESETS);

type ExperimentType = 'youtube' | 'watch-party';

export function NewFrontPage() {
  const [room, setRoom] = useState('');
  const typewriterText = useTypewriter(ROOM_SUGGESTIONS);

  const [experimentType, setExperimentType] = useState<ExperimentType>('youtube');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [watchPartyUrl, setWatchPartyUrl] = useState('');
  const [style, setStyle] = useState('default');

  const activeVideoUrl = experimentType === 'youtube' ? youtubeUrl : watchPartyUrl;
  const setActiveVideoUrl = experimentType === 'youtube' ? setYoutubeUrl : setWatchPartyUrl;

  function handleOpen(emcee: boolean) {
    window.location.href = buildV4Url(room, emcee);
  }

  function handleOpenExperiment() {
    window.location.href = buildExperimentUrl(experimentType, activeVideoUrl, style);
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
            <button
              className="nfp-btn nfp-btn-primary"
              onClick={() => handleOpen(false)}
            >
              Participant View
            </button>
            <button
              className="nfp-btn nfp-btn-secondary"
              onClick={() => handleOpen(true)}
            >
              Emcee View
            </button>
          </div>
        </div>

        {/* Experiments */}
        <section className="nfp-section">
          <h2 className="nfp-section-title">Experiments</h2>
          <p className="nfp-section-desc">Potential variants of the UI in prototype form.</p>

          <div className="nfp-experiment-card-group">
            {/* YouTube Videos option */}
            <div
              className={`nfp-experiment-card ${experimentType === 'youtube' ? 'nfp-experiment-card--active' : ''}`}
              onClick={() => setExperimentType('youtube')}
            >
              <div className="nfp-experiment-row">
                <label className="nfp-experiment-label">
                  <input
                    type="radio"
                    name="experiment"
                    value="youtube"
                    checked={experimentType === 'youtube'}
                    onChange={() => setExperimentType('youtube')}
                    onClick={e => e.stopPropagation()}
                  />
                  YouTube Videos
                </label>
                <input
                  className="nfp-experiment-url-input"
                  type="url"
                  placeholder="YouTube URL"
                  value={youtubeUrl}
                  onChange={e => setYoutubeUrl(e.target.value)}
                  onClick={e => e.stopPropagation()}
                />
              </div>
              {experimentType === 'youtube' && (
                <div className="nfp-experiment-controls">
                  <label className="nfp-style-label">
                    Style:
                    <select
                      className="nfp-style-select"
                      value={style}
                      onChange={e => setStyle(e.target.value)}
                    >
                      {PRESET_KEYS.map(key => (
                        <option key={key} value={key}>{key}</option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="nfp-admin-link"
                    onClick={e => { e.stopPropagation(); handleOpenV5Admin(); }}
                  >
                    Admin
                  </button>
                </div>
              )}
            </div>

            {/* Sync'd YouTube Watch Party option */}
            <div
              className={`nfp-experiment-card ${experimentType === 'watch-party' ? 'nfp-experiment-card--active' : ''}`}
              onClick={() => setExperimentType('watch-party')}
            >
              <div className="nfp-experiment-row">
                <label className="nfp-experiment-label">
                  <input
                    type="radio"
                    name="experiment"
                    value="watch-party"
                    checked={experimentType === 'watch-party'}
                    onChange={() => setExperimentType('watch-party')}
                    onClick={e => e.stopPropagation()}
                  />
                  Sync'd YouTube Watch Party
                </label>
                <input
                  className="nfp-experiment-url-input"
                  type="url"
                  placeholder="YouTube URL"
                  value={watchPartyUrl}
                  onChange={e => setWatchPartyUrl(e.target.value)}
                  onClick={e => e.stopPropagation()}
                />
              </div>
              {experimentType === 'watch-party' && (
                <div className="nfp-experiment-controls">
                  <label className="nfp-style-label">
                    Style:
                    <select
                      className="nfp-style-select"
                      value={style}
                      onChange={e => setStyle(e.target.value)}
                    >
                      {PRESET_KEYS.map(key => (
                        <option key={key} value={key}>{key}</option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
            </div>
          </div>

          <button
            className="nfp-btn nfp-btn-primary nfp-experiment-open"
            onClick={handleOpenExperiment}
          >
            Open Experiment
          </button>
        </section>

        {/* More Prototypes */}
        <section className="nfp-section nfp-section--prototypes">
          <h2 className="nfp-section-title">More Prototypes</h2>
          <ul className="nfp-proto-list">
            <li>
              <a className="nfp-proto-link" href="/valence-onboarding-v2.html">
                Valence Visualizer V2
              </a>
            </li>
            <li>
              <a className="nfp-proto-link" href="#valence-viz">
                Valence Visualizer V1
              </a>
            </li>
            <li>
              <a className="nfp-proto-link" href="/mood-sounds.html">
                Valence Tones
              </a>
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
