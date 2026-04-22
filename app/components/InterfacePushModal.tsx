interface InterfacePushModalProps {
  interfaceName: string;
  onAccept: () => void;
  onDecline: () => void;
}

export default function InterfacePushModal({ interfaceName, onAccept, onDecline }: InterfacePushModalProps) {
  return (
    <div className="github-modal-overlay" onClick={onDecline}>
      <div className="github-modal" onClick={e => e.stopPropagation()}>
        <div className="github-modal-title">You've been invited</div>
        <div className="github-modal-body">
          The emcee has assigned you the role: <strong style={{ color: '#eee' }}>{interfaceName}</strong>. Would you like to accept?
        </div>
        <button className="github-modal-btn-primary" onClick={onAccept}>Accept</button>
        <button className="github-modal-btn-dismiss" onClick={onDecline}>Not now</button>
      </div>
    </div>
  );
}
