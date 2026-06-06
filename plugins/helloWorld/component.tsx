import { useState } from 'react';
import usePartySocket from 'partysocket/react';
import { getPartySocketConfig } from '../../app/utils/partyHost';
import { usePanelContext } from '../../app/context/PanelContext';

export default function HelloWorldPanel() {
  const { room } = usePanelContext();
  const [message, setMessage] = useState('Hello, world!');

  usePartySocket({
    ...getPartySocketConfig(),
    room,
    onMessage(evt) {
      try {
        const data = JSON.parse(evt.data);
        if (data.type === 'helloWorldState') setMessage(data.message);
      } catch {}
    },
  });

  return (
    <div style={{ padding: 24, background: '#0f0f0e', color: '#eee', fontSize: 20, textAlign: 'center', minHeight: '100%' }}>
      {message}
    </div>
  );
}
