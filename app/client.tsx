import "./styles.css";
import { createRoot } from "react-dom/client";
import { useState, useEffect } from "react";
import SimpleReactionCanvasAppV1 from "./components/SimpleReactionCanvasAppV1";
import ReactionCanvasAppV2 from "./components/ReactionCanvasAppV2";
import ReactionCanvasAppV3 from "./components/ReactionCanvasAppV3";

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
      </div>
    </div>
  );
}

function App() {
  const [hash, setHash] = useState(window.location.hash);

  useEffect(() => {
    const handleHashChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  if (hash === '#v1') return <SimpleReactionCanvasAppV1 />;
  if (hash === '#v2') return <ReactionCanvasAppV2 />;
  if (hash === '#v3') return <ReactionCanvasAppV3 />;
  return <IndexApp />;
}

createRoot(document.getElementById("app")!).render(<App />);
