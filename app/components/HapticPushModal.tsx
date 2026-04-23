interface HapticPushModalProps {
  onAccept: () => void;
  onDecline: () => void;
}

export default function HapticPushModal({ onAccept, onDecline }: HapticPushModalProps) {
  return (
    <div className="github-modal-overlay" onClick={onDecline}>
      <div className="github-modal" onClick={e => e.stopPropagation()}>
        <div className="github-modal-title">Attention request</div>
        <div className="github-modal-body">
          The facilitator wants to get your attention with a haptic buzz. Allow it?
        </div>
        <button className="github-modal-btn-primary" onClick={onAccept}>Buzz me</button>
        <button className="github-modal-btn-dismiss" onClick={onDecline}>Not now</button>
      </div>
    </div>
  );
}
