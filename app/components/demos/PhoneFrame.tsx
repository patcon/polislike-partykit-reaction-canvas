import type { ReactNode } from "react";

interface PhoneFrameProps {
  children: ReactNode;
  label?: string;
}

/**
 * Presentational phone mockup. The `.demo-phone-screen` is a fixed-size,
 * position:relative, flex-column container — the box that embedded panels size to
 * (Canvas with `autoSize`, AdminPanelNoDB's `flex: 1`, etc.).
 */
export default function PhoneFrame({ children, label }: PhoneFrameProps) {
  return (
    <div className="demo-phone-wrap">
      <div className="demo-phone">
        <div className="demo-phone-screen">{children}</div>
      </div>
      {label && <div className="demo-phone-label">{label}</div>}
    </div>
  );
}
