import { useState, useEffect, type ReactNode } from "react";

interface DemoLayoutProps {
  title: string;
  room: string;
  left: ReactNode;
  right: ReactNode;
}

// Two phone frames (~360px each) + gap + page padding need roughly this much
// horizontal room. Below it, the side-by-side layout doesn't fit, so we gate.
const MIN_DEMO_WIDTH = 860;

function useViewportWideEnough(): boolean {
  const [wide, setWide] = useState(() => window.innerWidth >= MIN_DEMO_WIDTH);
  useEffect(() => {
    const update = () => setWide(window.innerWidth >= MIN_DEMO_WIDTH);
    window.addEventListener("resize", update);
    update();
    return () => window.removeEventListener("resize", update);
  }, []);
  return wide;
}

/**
 * Shared shell for a side-by-side demo page. Gated on viewport width (not touch:
 * a touch-capable laptop like a Surface Pro is fine — a narrow phone screen isn't).
 * Renders a header (title + the active random `demo-<uuid>` room) above a two-up
 * phone layout.
 */
export default function DemoLayout({ title, room, left, right }: DemoLayoutProps) {
  const wideEnough = useViewportWideEnough();

  if (!wideEnough) {
    return (
      <div className="demo-mobile-warning">
        <h2>Screen too narrow</h2>
        <p>
          These side-by-side demos need a wider screen (at least {MIN_DEMO_WIDTH}px).
          Open this page on a desktop browser, or widen the window.
        </p>
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
