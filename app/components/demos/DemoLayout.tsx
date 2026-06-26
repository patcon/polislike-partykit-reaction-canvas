import type { ReactNode } from "react";
import { isTouchDevice } from "../../utils/device";

interface DemoLayoutProps {
  title: string;
  room: string;
  left: ReactNode;
  right: ReactNode;
}

/**
 * Shared shell for a side-by-side demo page. Desktop-only: on touch devices it
 * shows a warning instead of the panels. Renders a header (title + the active
 * random `demo-<uuid>` room, for reference) above a two-up phone layout.
 */
export default function DemoLayout({ title, room, left, right }: DemoLayoutProps) {
  if (isTouchDevice()) {
    return (
      <div className="demo-mobile-warning">
        <h2>Desktop only</h2>
        <p>These demos aren't mobile-capable yet — open this page on a desktop browser.</p>
      </div>
    );
  }

  return (
    <div className="demo-page">
      <header className="demo-header">
        <h1>{title}</h1>
        <code className="demo-room">{room}</code>
      </header>
      <div className="demo-two-up">
        {left}
        {right}
      </div>
    </div>
  );
}
