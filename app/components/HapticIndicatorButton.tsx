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
      {enabled ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <rect x="8" y="4" width="8" height="16" rx="1.5" />
          <line x1="5" y1="8" x2="6.5" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="4" y1="12" x2="6.5" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="5" y1="16" x2="6.5" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="17.5" y1="8" x2="19" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="17.5" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="17.5" y1="16" x2="19" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <rect x="8" y="4" width="8" height="16" rx="1.5" />
          <line x1="5" y1="8" x2="6.5" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="4" y1="12" x2="6.5" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="5" y1="16" x2="6.5" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="17.5" y1="8" x2="19" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="17.5" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="17.5" y1="16" x2="19" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="3" y1="21" x2="21" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      )}
    </button>
  );
}
