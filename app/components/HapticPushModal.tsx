import { WebHaptics } from "web-haptics";
import { useWebHaptics } from "web-haptics/react";

interface HapticPushModalProps {
  onAccept: () => void;
  onDecline: () => void;
}

export default function HapticPushModal({ onAccept, onDecline }: HapticPushModalProps) {
  const { trigger } = useWebHaptics();

  return (
    <div className="github-modal-overlay" onClick={onDecline}>
      <div className="github-modal" onClick={e => e.stopPropagation()}>
        <div className="github-modal-title">Attention request</div>
        {WebHaptics.isSupported ? (
          <>
            <div className="github-modal-body">
              The facilitator wants to get your attention with a haptic buzz. Allow it? <span style={{ color: '#888', fontSize: '0.9em' }}>(unless silent mode)</span>
            </div>
            <button className="github-modal-btn-primary" onClick={() => { trigger('nudge'); onAccept(); }}>Buzz me</button>
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
