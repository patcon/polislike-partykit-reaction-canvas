import type { ReactionLabelSet } from "../../voteLabels";
import type { PushTarget } from "./types";

interface SendPopupModalProps {
  pushTarget: PushTarget;
  activeLabels: ReactionLabelSet;
  onSend: () => void;
  onClose: () => void;
}

export default function SendPopupModal({ pushTarget, activeLabels, onSend, onClose }: SendPopupModalProps) {
  const targetDescription =
    pushTarget.kind === 'user'
      ? <span style={{ color: '#ccc', fontFamily: 'monospace' }}>{pushTarget.userId}</span>
      : pushTarget.kind === 'users'
        ? <span style={{ color: '#ccc' }}>{pushTarget.label} ({pushTarget.userIds.length})</span>
        : <span style={{ color: '#ccc' }}>{pushTarget.region === null ? 'Lurking' : activeLabels[pushTarget.region]} group</span>;

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onPointerDown={onClose}
    >
      <div
        style={{ background: '#1e1e1e', border: '1px solid #444', borderRadius: 10, padding: '20px 20px 16px', width: 280, display: 'flex', flexDirection: 'column', gap: 12 }}
        onPointerDown={e => e.stopPropagation()}
      >
        <div style={{ fontSize: 13, color: '#888' }}>
          Send popup to {targetDescription}
        </div>
        <div style={{ background: '#252525', border: '1px solid #333', borderRadius: 6, padding: '10px 12px' }}>
          <p style={{ fontWeight: 600, margin: '0 0 2px', fontSize: 13, color: '#ddd' }}>Coder role</p>
          <p style={{ color: '#666', fontSize: 12, margin: 0 }}>Asks for their GitHub username to confirm they can contribute code.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onSend}
            autoFocus
            style={{ flex: 1, padding: '8px', background: '#2a5cba', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}
          >
            Send
          </button>
          <button
            onClick={onClose}
            style={{ padding: '8px 14px', background: 'none', border: '1px solid #444', color: '#888', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
