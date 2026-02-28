import "./styles.css";
import { createRoot } from "react-dom/client";
import { useState, useEffect } from "react";
import SimpleReactionCanvasAppV1 from "./components/SimpleReactionCanvasAppV1";

function IndexApp() {
  return (
    <div className="index-app">
      <h1 className="index-title">Polislike Apps</h1>
      <div className="app-cards">
        <a href="#v1" className="app-card">
          <div className="app-card-content">
            <h2 className="app-card-title">Simple Reaction Canvas</h2>
            <p className="app-card-description">Collaborative voting canvas with real-time cursor tracking and Polis statement display.</p>
          </div>
          <span className="app-card-arrow">→</span>
        </a>
        <a href="?ghostCursors=true#v1" className="app-card">
          <div className="app-card-content">
            <h2 className="app-card-title">Reaction Canvas — Ghost Cursors</h2>
            <p className="app-card-description">Same as above, with 10 simulated ghost cursors moving between voting regions.</p>
          </div>
          <span className="app-card-arrow">→</span>
        </a>
        <a href="?admin=true#v1" className="app-card">
          <div className="app-card-content">
            <h2 className="app-card-title">Admin Panel</h2>
            <p className="app-card-description">Queue statements for display and monitor submitted votes.</p>
          </div>
          <span className="app-card-arrow">→</span>
        </a>
        <a href="?room=3ntrtcehas&admin=true#v1" className="app-card">
          <div className="app-card-content">
            <h2 className="app-card-title">Admin Panel — pol.is/3ntrtcehas</h2>
            <p className="app-card-description">Admin view pre-loaded with statements from the pol.is/3ntrtcehas conversation.</p>
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
  return <IndexApp />;
}

createRoot(document.getElementById("app")!).render(<App />);
