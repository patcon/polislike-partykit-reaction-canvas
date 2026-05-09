import { MdScreenLockLandscape, MdSmartScreen } from "react-icons/md";

interface Props {
  enabled: boolean;
  active: boolean;
  onToggle: () => void;
}

export default function WakeLockIndicatorButton({ enabled, active, onToggle }: Props) {
  const classes = [
    'wakelock-indicator-btn',
    !enabled ? 'wakelock-indicator-btn--off' : '',
  ].filter(Boolean).join(' ');

  return (
    <button
      className={classes}
      onClick={onToggle}
      aria-label={enabled ? "Disable screen wake lock" : "Enable screen wake lock"}
    >
      {enabled && active ? <MdScreenLockLandscape size={20} /> : <MdSmartScreen size={20} />}
    </button>
  );
}
