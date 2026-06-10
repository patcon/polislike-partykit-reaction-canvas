import "./styles.css";
declare const PARTYKIT_EVENT_BUILD: boolean;
declare const APP_TITLE: string;
import { createRoot } from "react-dom/client";
import { useState, useEffect } from "react";
import SimpleReactionCanvasAppV1 from "./components/apps/SimpleReactionCanvasAppV1";
import ReactionCanvasAppV2 from "./components/apps/ReactionCanvasAppV2";
import ReactionCanvasAppV4 from "./components/apps/ReactionCanvasAppV4";
import ReactionCanvasAppV5 from "./components/apps/ReactionCanvasAppV5";
import ValenceViz from "./components/viz/ValenceViz";
import PerfCanvasApp from "./components/apps/PerfCanvasApp";
import { OldFrontPage } from "./components/OldFrontPage";

const TITLES: Record<string, (admin: boolean) => string> = {
  '#v1': (admin) => admin ? 'Statement Admin — Polislike' : 'Statement Voting — Polislike',
  '#v2': ()      => 'YouTube Reaction (Sync) — Polislike',
  '#perf': () => 'Perf Test Canvas — Polislike',
  '#v4': (admin) => admin ? 'Live Event Admin — Polislike' : 'Live Reaction Canvas — Polislike',
  '#v5': (admin) => admin ? 'YouTube Reaction Admin — Polislike' : 'YouTube Reaction (Async) — Polislike',
  '#valence-viz': () => 'Valence Viz — Polislike',
};

function GithubCorner() {
  return (
    <a href="https://github.com/patcon/polislike-partykit-reaction-canvas" className="github-corner" aria-label="View source on GitHub" target="_blank" rel="noopener noreferrer">
      <svg width="50" height="50" viewBox="0 0 250 250" aria-hidden="true">
        <path d="M0,0 L115,115 L130,115 L142,142 L250,250 L250,0 Z"/>
        <path d="M128.3,109.0 C113.8,99.7 119.0,89.6 119.0,89.6 C122.0,82.7 120.5,78.6 120.5,78.6 C119.2,72.0 123.4,76.3 123.4,76.3 C127.3,80.9 125.5,87.3 125.5,87.3 C122.9,97.6 130.6,101.9 134.4,103.2" fill="currentColor" style={{transformOrigin: "130px 106px"}} className="octo-arm"/>
        <path d="M115.0,115.0 C114.9,115.1 118.7,116.5 119.8,115.4 L133.7,101.6 C136.9,99.2 139.9,98.4 142.2,98.6 C133.8,88.0 127.5,74.4 143.8,58.0 C148.5,53.4 154.0,51.2 159.7,51.0 C160.3,49.4 163.2,43.6 171.4,40.1 C171.4,40.1 176.1,42.5 178.8,56.2 C183.1,58.6 187.2,61.8 190.9,65.4 C194.5,69.0 197.7,73.2 200.1,77.6 C213.8,80.2 216.3,84.9 216.3,84.9 C212.7,93.1 206.9,96.0 205.4,96.6 C205.1,102.4 203.0,107.8 198.3,112.5 C181.9,128.9 168.3,122.5 157.7,114.1 C157.9,116.9 156.7,120.9 152.7,124.9 L141.0,136.5 C139.8,137.7 141.6,141.9 141.8,141.8 Z" fill="currentColor" className="octo-body"/>
      </svg>
    </a>
  );
}

function App() {
  const [hash, setHash] = useState(window.location.hash);

  useEffect(() => {
    const handleHashChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    const isAdmin = new URLSearchParams(window.location.search).get('admin') === 'true';
    document.title = TITLES[hash]?.(isAdmin) ?? APP_TITLE;
  }, [hash]);

  let page;
  if (hash === '#v1') page = <SimpleReactionCanvasAppV1 />;
  else if (hash === '#v2') page = <ReactionCanvasAppV2 />;
  else if (hash === '#v3') { window.location.hash = '#v4'; return null; }
  else if (hash === '#v4') page = <ReactionCanvasAppV4 />;
  else if (hash === '#v5') page = <ReactionCanvasAppV5 />;
  else if (hash === '#valence-viz') page = <ValenceViz />;
  else if (hash === '#perf') page = <PerfCanvasApp />;
  else page = <OldFrontPage />;

  return <>{page}{!PARTYKIT_EVENT_BUILD && <GithubCorner />}</>;
}

createRoot(document.getElementById("app")!).render(<App />);
