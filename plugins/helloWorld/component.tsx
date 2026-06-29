import { useState } from 'react';
import { useMessageSubscription } from '../../app/contexts/RoomSocketContext';

export default function HelloWorldPanel() {
  const [message, setMessage] = useState('Hello, world!');

  useMessageSubscription((evt) => {
    try {
      const data = JSON.parse(evt.data);
      if (data.type === 'helloWorldState') setMessage(data.message);
    } catch {}
  });

  return (
    <div style={{ padding: 24, background: '#0f0f0e', color: '#eee', fontSize: 20, textAlign: 'center', minHeight: '100%' }}>
      {message}
    </div>
  );
}
