import "./styles.css";
import { createRoot } from "react-dom/client";
import { useState, useEffect } from "react";
import SimpleReactionCanvasAppV1 from "./components/SimpleReactionCanvasAppV1";
import ReactionCanvasAppV2 from "./components/ReactionCanvasAppV2";
import ReactionCanvasAppV3 from "./components/ReactionCanvasAppV3";
import ReactionCanvasAppV4 from "./components/ReactionCanvasAppV4";

function IndexApp() {
  return (
    <div className="index-app">
      <h1 className="index-title">Polislike Reaction Canvas Apps</h1>
      <div className="app-cards">
        <a href="#v1" className="app-card">
          <div className="app-card-content">
            <h2 className="app-card-title">V1: Participant View (Default)</h2>
            <p className="app-card-description">Collaborative voting canvas with real-time cursor tracking and Polis statement display.</p>
          </div>
          <span className="app-card-arrow">→</span>
        </a>
        <a href="?ghostCursors=true#v1" className="app-card">
          <div className="app-card-content">
            <h2 className="app-card-title">V1: Participant View (Fake Users)</h2>
            <p className="app-card-description">Same as above, with 10 simulated ghost cursors moving between voting regions.</p>
          </div>
          <span className="app-card-arrow">→</span>
        </a>
        <a href="?admin=true#v1" className="app-card">
          <div className="app-card-content">
            <h2 className="app-card-title">V1: Admin View (Default)</h2>
            <p className="app-card-description">Queue statements for display and monitor submitted votes.</p>
          </div>
          <span className="app-card-arrow">→</span>
        </a>
        <a href="?room=3ntrtcehas&admin=true#v1" className="app-card">
          <div className="app-card-content">
            <h2 className="app-card-title">V1: Admin View (Polis Statements)</h2>
            <p className="app-card-description">Admin view pre-loaded with statements from the pol.is/3ntrtcehas conversation.</p>
          </div>
          <span className="app-card-arrow">→</span>
        </a>
        <a href="#v2" className="app-card">
          <div className="app-card-content">
            <h2 className="app-card-title">V2: YouTube (Blank)</h2>
            <p className="app-card-description">YouTube embed + reaction canvas. No video set — add <code>?videoId=</code> to the URL.</p>
          </div>
          <span className="app-card-arrow">→</span>
        </a>
        <a href="?videoId=s-ONlhskCrA#v2" className="app-card">
          <div className="app-card-content">
            <h2 className="app-card-title">V2: YouTube (Example)</h2>
            <p className="app-card-description">YouTube embed + reaction canvas with an example video pre-loaded.</p>
          </div>
          <span className="app-card-arrow">→</span>
        </a>
        <a href="#v3" className="app-card">
          <div className="app-card-content">
            <h2 className="app-card-title">V3: Reaction Canvas</h2>
            <p className="app-card-description">Full-page canvas, no video, no statements. Mobile-only with QR gate on desktop.</p>
          </div>
          <span className="app-card-arrow">→</span>
        </a>
        <a href="?admin=true#v3" className="app-card">
          <div className="app-card-content">
            <h2 className="app-card-title">V3: Admin (Record Reactions)</h2>
            <p className="app-card-description">Record live audience reaction data for offline analysis. Downloads as JSON.</p>
          </div>
          <span className="app-card-arrow">→</span>
        </a>
        <a href="#v4" className="app-card">
          <div className="app-card-content">
            <h2 className="app-card-title">V4: Reaction Canvas</h2>
            <p className="app-card-description">Full-page canvas, no video, no statements. Mobile-only with QR gate on desktop.</p>
          </div>
          <span className="app-card-arrow">→</span>
        </a>
        <a href="?admin=true#v4" className="app-card">
          <div className="app-card-content">
            <h2 className="app-card-title">V4: Admin (Record Reactions)</h2>
            <p className="app-card-description">Record live audience reaction data for offline analysis. Downloads as JSON.</p>
          </div>
          <span className="app-card-arrow">→</span>
        </a>
      </div>
    </div>
  );
}

const TITLES: Record<string, (admin: boolean) => string> = {
  '#v1': (admin) => admin ? 'Statement Admin — Polislike' : 'Statement Voting — Polislike',
  '#v2': ()      => 'YouTube Reaction (Sync) — Polislike',
  '#v3': (admin) => admin ? 'Reaction Recorder — Polislike' : 'Reaction Canvas — Polislike',
  '#v4': (admin) => admin ? 'Live Event Admin — Polislike' : 'Live Reaction Canvas — Polislike',
};

function App() {
  const [hash, setHash] = useState(window.location.hash);

  useEffect(() => {
    const handleHashChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    const isAdmin = new URLSearchParams(window.location.search).get('admin') === 'true';
    document.title = TITLES[hash]?.(isAdmin) ?? 'Polislike Reaction Canvas';
  }, [hash]);

  if (hash === '#v1') return <SimpleReactionCanvasAppV1 />;
  if (hash === '#v2') return <ReactionCanvasAppV2 />;
  if (hash === '#v3') return <ReactionCanvasAppV3 />;
  if (hash === '#v4') return <ReactionCanvasAppV4 />;
  return <IndexApp />;
}

createRoot(document.getElementById("app")!).render(<App />);
