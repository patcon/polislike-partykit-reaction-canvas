import { MdLock } from "react-icons/md";
import type { ReactNode } from "react";

interface PhoneFrameProps {
  children: ReactNode;
  label?: string;
  /** Placeholder address shown in the mock browser URL bar. */
  url?: string;
  /** Show a callout prompting the user to click the share QR button. */
  showSharePrompt?: boolean;
}

/**
 * Presentational phone mockup with a mock browser URL bar. The
 * `.demo-phone-content` is the fixed-size, position:relative, flex-column
 * container that embedded panels size to (Canvas with `autoSize`,
 * AdminPanelNoDB's `flex: 1`, etc.) — kept separate from the URL bar so the
 * canvas's absolute SVGs don't render behind it.
 */
export default function PhoneFrame({ children, label, url = "whispering-gallery.dev", showSharePrompt }: PhoneFrameProps) {
  return (
    <div className="demo-phone-wrap">
      {showSharePrompt && (
        <div className="demo-phone-share-prompt">
          <span className="demo-phone-share-prompt-arrow">↘</span>
          Click to join from your phone
        </div>
      )}
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
