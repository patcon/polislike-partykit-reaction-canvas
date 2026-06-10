import QRWithCopy from './shared/QRWithCopy';

declare const APP_TITLE: string;
const DEFAULT_TITLE = typeof APP_TITLE !== 'undefined' ? APP_TITLE : 'Whispering Gallery';

export function OldFrontPage({ title = DEFAULT_TITLE }: { title?: string }) {
  const pageUrl = window.location.origin + window.location.pathname;
  return (
    <div className="index-app">
      <h1 className="index-title">{title} Apps</h1>
      <div className="index-qr">
        <QRWithCopy url={pageUrl} size={120} urlClassName="index-qr-label" qrClassName="index-qr-code" />
      </div>
      <div className="app-cards">
        <a href="?room=irc6creOFGs#v5" className="app-card app-card--youtube">
          <div className="app-card-content">
            <h2 className="app-card-title">V5 Participation: YouTube Async</h2>
            <p className="app-card-description">Async YouTube + reaction canvas with an example video. Past reactions replay as cursors in sync with the video timecode.</p>
          </div>
          <span className="app-card-arrow">→</span>
        </a>
        <a href="?admin=true#v5" className="app-card">
          <div className="app-card-content">
            <h2 className="app-card-title">V5 Admin: Database</h2>
            <p className="app-card-description">Manage labels, anchors, and participant cap. View and clear Supabase reaction recordings.</p>
          </div>
          <span className="app-card-arrow">→</span>
        </a>
        <a href="#v4" className="app-card">
          <div className="app-card-content">
            <h2 className="app-card-title">V4 Participation: Basic Realtime</h2>
            <p className="app-card-description">Full-page canvas, no video, no statements. Mobile-only with QR gate on desktop.</p>
          </div>
          <span className="app-card-arrow">→</span>
        </a>
        <a href="?admin=true#v4" className="app-card">
          <div className="app-card-content">
            <h2 className="app-card-title">V4 Admin: No Database</h2>
            <p className="app-card-description">Record live audience reaction data for offline analysis. Downloads as JSON.</p>
          </div>
          <span className="app-card-arrow">→</span>
        </a>
        <a href="?room=irc6creOFGs#v2" className="app-card app-card--youtube">
          <div className="app-card-content">
            <h2 className="app-card-title">V2 Participation: YouTube Realtime</h2>
            <p className="app-card-description">YouTube embed + reaction canvas with an example video pre-loaded.</p>
          </div>
          <span className="app-card-arrow">→</span>
        </a>
        <a href="?room=3ntrtcehas#v1" className="app-card">
          <div className="app-card-content">
            <h2 className="app-card-title">V1 Participation: Statements (Polis)</h2>
            <p className="app-card-description">Collaborative voting canvas with real-time cursor tracking and Polis statement display.</p>
          </div>
          <span className="app-card-arrow">→</span>
        </a>
        <a href="/mood-sounds.html" className="app-card">
          <div className="app-card-content">
            <h2 className="app-card-title">Experience: Mood Sounds</h2>
            <p className="app-card-description">Facilitator tool: ambient generative sound driven by live audience cursor positions. Open in a separate tab — invisible to participant count.</p>
          </div>
          <span className="app-card-arrow">→</span>
        </a>
        <a href="#valence-viz" className="app-card">
          <div className="app-card-content">
            <h2 className="app-card-title">Experience: Valence Viz</h2>
            <p className="app-card-description">Facilitator tool: 3D particle/wave visualization of audience sentiment. Synthetic demo by default; Audience Sync drives it live from cursor positions.</p>
          </div>
          <span className="app-card-arrow">→</span>
        </a>
        <a href="/valence-onboarding-v1.html" className="app-card">
          <div className="app-card-content">
            <h2 className="app-card-title">Onboarding: Valence V1</h2>
            <p className="app-card-description">Interactive onboarding experience for the valence wave visualization.</p>
          </div>
          <span className="app-card-arrow">→</span>
        </a>
        <a href="/valence-onboarding-v2.html" className="app-card">
          <div className="app-card-content">
            <h2 className="app-card-title">Onboarding: Valence V2</h2>
            <p className="app-card-description">Interactive onboarding experience for the valence wave visualization.</p>
          </div>
          <span className="app-card-arrow">→</span>
        </a>
        <a href="/valence-onboarding-v3.html" className="app-card">
          <div className="app-card-content">
            <h2 className="app-card-title">Onboarding: Valence V3</h2>
            <p className="app-card-description">Valence wave with particle-life physics mode.</p>
          </div>
          <span className="app-card-arrow">→</span>
        </a>
        <a href="?ghostCursors=true#v1" className="app-card">
          <div className="app-card-content">
            <h2 className="app-card-title">V1 Participation: Fake Users Demo</h2>
            <p className="app-card-description">Same as above, with 10 simulated ghost cursors moving between voting regions.</p>
          </div>
          <span className="app-card-arrow">→</span>
        </a>
        <a href="#perf" className="app-card">
          <div className="app-card-content">
            <h2 className="app-card-title">Perf Test Canvas</h2>
            <p className="app-card-description">Minimal cursor-only canvas wired to a stripped-down server. Use with the load test scripts to assess peak broadcast performance.</p>
          </div>
          <span className="app-card-arrow">→</span>
        </a>
        <a href="?room=3ntrtcehas&admin=true#v1" className="app-card">
          <div className="app-card-content">
            <h2 className="app-card-title">V1 Admin: Statement Queue</h2>
            <p className="app-card-description">Queue statements for display and monitor submitted votes.</p>
          </div>
          <span className="app-card-arrow">→</span>
        </a>
      </div>
    </div>
  );
}
