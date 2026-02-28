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
            <h2 className="app-card-title">Simple Reaction Canvas App</h2>
            <p className="app-card-description">Real-time collaborative voting canvas with cursor tracking and Polis statement display.</p>
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
