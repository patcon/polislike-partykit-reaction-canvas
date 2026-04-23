interface HapticPushModalProps {
  onDismiss: () => void;
}

export default function HapticPushModal({ onDismiss }: HapticPushModalProps) {
  return (
    <div className="github-modal-overlay" onClick={onDismiss}>
      <div className="github-modal" onClick={e => e.stopPropagation()}>
        <div className="github-modal-title">Attention request</div>
        <div className="github-modal-body">
          The facilitator tried to get your attention with a haptic buzz, but your device doesn't support it.
        </div>
        <button className="github-modal-btn-dismiss" onClick={onDismiss}>OK</button>
      </div>
    </div>
  );
}
