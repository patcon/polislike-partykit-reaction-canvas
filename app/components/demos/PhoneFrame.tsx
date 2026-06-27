import { MdLock } from "react-icons/md";
import type { ReactNode } from "react";

interface PhoneFrameProps {
  children: ReactNode;
  label?: string;
  /** Placeholder address shown in the mock browser URL bar. */
  url?: string;
}

/**
 * Presentational phone mockup with a mock browser URL bar. The
 * `.demo-phone-content` is the fixed-size, position:relative, flex-column
 * container that embedded panels size to (Canvas with `autoSize`,
 * AdminPanelNoDB's `flex: 1`, etc.) — kept separate from the URL bar so the
 * canvas's absolute SVGs don't render behind it.
 */
export default function PhoneFrame({ children, label, url = "whispering-gallery.dev" }: PhoneFrameProps) {
  return (
    <div className="demo-phone-wrap">
      <div className="demo-phone">
        <div className="demo-phone-screen">
          <div className="demo-phone-urlbar">
            <MdLock className="demo-phone-urlbar-lock" />
            <span className="demo-phone-urlbar-text">{url}</span>
          </div>
          <div className="demo-phone-content">{children}</div>
        </div>
      </div>
      {label && <div className="demo-phone-label">{label}</div>}
    </div>
  );
}
