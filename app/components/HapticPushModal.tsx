interface HapticPushModalProps {
  onAccept: () => void;
  onDecline: () => void;
}

export default function HapticPushModal({ onAccept, onDecline }: HapticPushModalProps) {
  const canVibrate = typeof navigator.vibrate === 'function';

  return (
    <div className="github-modal-overlay" onClick={onDecline}>
      <div className="github-modal" onClick={e => e.stopPropagation()}>
        <div className="github-modal-title">Attention request</div>
        {canVibrate ? (
          <>
            <div className="github-modal-body">
              The facilitator wants to get your attention with a haptic buzz. Allow it? <span style={{ color: '#888', fontSize: '0.9em' }}>(unless silent mode)</span>
            </div>
            <button className="github-modal-btn-primary" onClick={onAccept}>Buzz me</button>
            <button className="github-modal-btn-dismiss" onClick={onDecline}>Not now</button>
          </>
        ) : (
          <>
            <div className="github-modal-body">
              The facilitator tried to get your attention with a haptic buzz, but your device doesn't support it.
            </div>
            <button className="github-modal-btn-dismiss" onClick={onDecline}>OK</button>
          </>
        )}
      </div>
    </div>
  );
}
