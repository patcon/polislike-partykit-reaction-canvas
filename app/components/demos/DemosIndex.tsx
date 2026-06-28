import { Link } from "@tanstack/react-router";

/** Landing page listing the available side-by-side demos. */
export default function DemosIndex() {
  return (
    <div className="demo-page demo-index">
      <header className="demo-header">
        <h1>Demos</h1>
        <p className="demo-note">
          Side-by-side previews of the two-role experience. Desktop only.
        </p>
      </header>
      <ul className="demo-list">
        <li>
          <Link to="/demos/admin-canvas">Admin + Reaction Canvas</Link>
          <span className="demo-list-desc">Emcee controls driving a live participant canvas.</span>
        </li>
        <li>
          <Link to="/demos/canvas-mood">Reaction Canvas + Mood Tones</Link>
          <span className="demo-list-desc">Participant cursors feeding the mood-tones readout.</span>
        </li>
      </ul>
    </div>
  );
}
