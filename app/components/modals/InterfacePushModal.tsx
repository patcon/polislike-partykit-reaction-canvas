interface InterfacePushModalProps {
  interfaceName: string;
  onAccept: () => void;
  onDecline: () => void;
}

export default function InterfacePushModal({ interfaceName, onAccept, onDecline }: InterfacePushModalProps) {
  return (
    <div className="app-modal-overlay" onClick={onDecline}>
      <div className="app-modal" onClick={e => e.stopPropagation()}>
        <div className="app-modal-title">You've been invited</div>
        <div className="app-modal-body">
          The emcee has assigned you the role: <strong style={{ color: '#eee' }}>{interfaceName}</strong>. Would you like to accept?
        </div>
        <button className="app-modal-btn-primary" onClick={onAccept}>Accept</button>
        <button className="app-modal-btn-dismiss" onClick={onDecline}>Not now</button>
      </div>
    </div>
  );
}
