import { useState, useCallback } from 'react';
import usePartySocket from 'partysocket/react';
import { usePanelContext } from '../../app/context/PanelContext';
import { getPartySocketConfig } from '../../app/utils/partyHost';
import SignatureLayer from './SignatureLayer';
import SignatureCanvas from './SignatureCanvas';

type Stroke = { strokeId: string; points: Array<{ x: number; y: number }> };

export default function SignatureCanvasPanel() {
  const { room, userId } = usePanelContext();
  const [isPresenter, setIsPresenter] = useState(false);
  const [strokes, setStrokes] = useState<Record<string, Stroke[]>>({});

  const socket = usePartySocket({
    ...getPartySocketConfig(),
    room,
    onMessage(e: MessageEvent) {
      const data = JSON.parse(e.data);
      if (data.type === 'strokeSegment') {
        const { userId: uid, strokeId, points, isFinal } = data as {
          userId: string; strokeId: string;
          points: Array<{ x: number; y: number }>; isFinal: boolean;
        };
        setStrokes(prev => {
          const user = [...(prev[uid] ?? [])];
          const idx = user.findIndex(s => s.strokeId === strokeId);
          if (idx === -1) return { ...prev, [uid]: [...user, { strokeId, points }] };
          const updated = [...user];
          updated[idx] = { strokeId, points: isFinal ? updated[idx].points : [...updated[idx].points, ...points] };
          return { ...prev, [uid]: updated };
        });
      }
      if (data.type === 'signatureCleared') {
        setStrokes(prev => { const n = { ...prev }; delete n[data.userId]; return n; });
      }
    },
  });

  const sendMessage = useCallback((msg: string) => socket.send(msg), [socket]);

  return (
    <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
      {isPresenter ? (
        <SignatureCanvas userId={userId} strokes={strokes} />
      ) : (
        <SignatureLayer userId={userId} onSendMessage={sendMessage} />
      )}
      <button
        onClick={() => setIsPresenter(p => !p)}
        style={{
          position: 'absolute',
          top: 7,
          right: 'calc(6% + 46px)',
          zIndex: 30,
          height: 30,
          padding: '0 14px',
          borderRadius: 999,
          border: '1px solid rgba(255,255,255,0.7)',
          background: 'rgba(60,60,60,0.72)',
          color: 'rgba(255,255,255,0.95)',
          fontSize: 13,
          cursor: 'pointer',
          letterSpacing: '0.04em',
          whiteSpace: 'nowrap',
        }}
      >
        {isPresenter ? 'Sign' : 'Show: Grid'}
      </button>
    </div>
  );
}
