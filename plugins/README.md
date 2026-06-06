# Plugin system

Each plugin lives in its own subdirectory and is registered in `plugins/index.ts`. A plugin can have a client panel component, a config modal, server-side lifecycle handlers, or any combination.

The `helloWorld` plugin (`plugins/helloWorld/`) is a minimal working example you can copy and adapt.

## Activating helloWorld

Uncomment the two lines in `plugins/index.ts`:

```ts
import helloWorldPlugin from './helloWorld/index';
// ...
export const PLUGINS: PanelPlugin[] = [soccerPlugin, greeterPlugin, helloWorldPlugin];
```

## Adding a new plugin from scratch

### 1. Create the directory and files

```
plugins/
  helloWorld/
    index.ts          ← plugin metadata + wiring
    types.ts          ← plugin-owned state shape
    server.ts         ← server-side lifecycle handlers
    component.tsx     ← panel UI (shown in chip bar / activity overlay)
    configModal.tsx   ← settings modal opened from the gear icon
```

### 2. Define the state shape (`types.ts`)

```ts
export type HelloWorldPluginState = { message: string };
```

### 3. Server-side lifecycle (`server.ts`)

```ts
import type { ServerPlugin, PluginConnection, PluginContext } from '../types';
import type { HelloWorldPluginState } from './types';

export const HelloWorldServerPlugin: ServerPlugin<HelloWorldPluginState> = {
  createState(): HelloWorldPluginState {
    return { message: 'Hello, world!' };
  },

  onConnect(conn: PluginConnection, _ctx: PluginContext, state: HelloWorldPluginState): void {
    // Push current state to the newly-connected client
    conn.send(JSON.stringify({ type: 'helloWorldState', message: state.message }));
  },

  onMessage(type, payload, _conn, ctx, state): boolean {
    if (type !== 'setHelloWorldMessage') return false;
    state.message = (payload as { message: string }).message;
    ctx.broadcast(JSON.stringify({ type: 'helloWorldState', message: state.message }));
    void ctx.persistState();
    return true;
  },

  onActivate(): void {},
  onDeactivate(): void {},

  getPersistedState(state): unknown { return { message: state.message }; },

  applyPersistedState(state, saved): void {
    const s = saved as HelloWorldPluginState | null;
    if (s?.message) state.message = s.message;
  },
};
```

Key rules:
- `onConnect` must push current state to the new client so it renders correctly.
- `onMessage` returns `true` when it handles the message (stops further processing), `false` to fall through.
- Call `ctx.persistState()` after any mutation you want to survive a server restart.

### 4. Panel component (`component.tsx`)

Rendered in the chip bar or as an activity overlay when the plugin is active. Uses `usePanelContext()` to get `room` — no props are passed.

```tsx
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
```

### 5. Config modal (`configModal.tsx`)

Opened from the gear icon in the Interfaces tab. Uses `useAdminSocket()` to read state and send messages — the only prop from the parent is `onClose`.

`getLastMessage(type)` returns the last cached message of that type. Because `onConnect` sends `helloWorldState` on every connection, this is always populated before a user can open the modal.

```tsx
import { useState, useEffect } from 'react';
import { useAdminSocket } from '../../app/components/panels/AdminPanelNoDB/AdminSocketContext';

export default function HelloWorldConfigModal({ onClose }: { onClose: () => void }) {
  const { send, subscribe, getLastMessage } = useAdminSocket();

  const [message, setMessage] = useState<string>(() => {
    return (getLastMessage('helloWorldState')?.message as string) ?? 'Hello, world!';
  });

  useEffect(() => {
    return subscribe(data => {
      if (data.type === 'helloWorldState') setMessage(data.message as string);
    });
  }, [subscribe]);

  const handleSave = () => {
    send({ type: 'setHelloWorldMessage', message });
    onClose();
  };

  return (
    <div className="github-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="github-modal">
        <p className="github-modal-title">Hello World settings</p>
        <input
          className="github-modal-input"
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Enter a greeting…"
        />
        <button className="github-modal-btn-primary" onClick={handleSave} style={{ marginTop: 16 }}>Save</button>
        <button className="github-modal-btn-dismiss" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}
```

### 6. Wire everything together (`index.ts`)

```ts
import type { PanelPlugin } from '../types';
import HelloWorldPanel from './component';
import HelloWorldConfigModal from './configModal';
import { HelloWorldServerPlugin } from './server';
import type { HelloWorldPluginState } from './types';

const helloWorldPlugin: PanelPlugin<HelloWorldPluginState> = {
  id: 'helloWorld',
  label: 'Hello World',
  description: 'A minimal example panel — editable greeting message',
  patchable: true,
  activityMode: true,
  component: HelloWorldPanel,
  configModal: HelloWorldConfigModal,
  server: HelloWorldServerPlugin,
};

export default helloWorldPlugin;
```

### 7. Register in `plugins/index.ts`

```ts
import helloWorldPlugin from './helloWorld/index';

export const PLUGINS: PanelPlugin[] = [soccerPlugin, greeterPlugin, helloWorldPlugin];
```

`AdminPanelNoDB` picks up new plugins automatically — no changes needed there.

## Field reference (`PanelPlugin`)

| Field | Required | Description |
|-------|----------|-------------|
| `id` | yes | Unique slug; used as activity name and PLUGIN_MAP key |
| `label` | yes | Display name in the Interfaces tab |
| `shortLabel` | no | Abbreviated label for tight spaces |
| `description` | yes | One-line description shown in the Interfaces tab |
| `patchable` | yes | `true` to allow emcee to push this interface to participants |
| `activityMode` | yes | `true` to wire this plugin into the Solo radio button |
| `component` | no | React component rendered in chip bar / activity overlay; uses `usePanelContext()` for `room` |
| `configModal` | no | React component for the gear-icon settings modal; receives only `{ onClose }`, uses `useAdminSocket()` |
| `server` | no | Server-side `ServerPlugin<S>` lifecycle object |
