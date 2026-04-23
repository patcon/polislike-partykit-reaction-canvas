import { LuVibrate, LuVibrateOff } from "react-icons/lu";

interface Props {
  enabled: boolean;
  flashing: boolean;
  canVibrate: boolean;
  onToggle: () => void;
}

export default function HapticIndicatorButton({ enabled, flashing, canVibrate, onToggle }: Props) {
  const classes = [
    'haptic-indicator-btn',
    flashing ? 'haptic-indicator-btn--flash' : '',
    !enabled ? 'haptic-indicator-btn--off' : '',
  ].filter(Boolean).join(' ');

  return (
    <button
      className={classes}
      onClick={canVibrate ? onToggle : undefined}
      aria-label={enabled ? "Disable haptic feedback" : "Enable haptic feedback"}
    >
      {enabled ? <LuVibrate size={20} /> : <LuVibrateOff size={20} />}
    </button>
  );
}
