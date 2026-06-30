# Draft: `SCREENS`-config refactor + `needsLifecycle`

Goal: stop hardcoding `personal`/`commons` at every call site. Make screens a
first-class list so a 3rd screen is one config entry, and make "this panel can't
live on a lifecycle-free screen" a **type-checked, enforced** rule instead of the
current accidental "only `personal` activates plugins" gate.

Confirmed precondition: today **only `soccer`** has a non-trivial
`onActivate`/`onDeactivate` (`engine.start()`); every other plugin's hooks are
no-ops. So `needsLifecycle` is a one-plugin flag now — exactly the minimal,
scoped change you suspected.

---

## 1. Single source of truth — `app/screens.ts` (new)

```ts
export interface ScreenDef {
  /** Wire/state key: screenPanels[name], screenPanelChanged.screenName, ?interface=<name> */
  name: string;
  /** Interfaces-tab column header */
  label: string;
  /** Chip-bar label (feeds KNOWN_CHIPS) */
  chipLabel: string;
  /** Runs server plugin lifecycle hooks (onActivate/onDeactivate). Exactly one screen should. */
  lifecycle: boolean;
  /** Unlocked via ?interface=<name>, parallel to emcee. (personal is always present.) */
  urlPrivileged: boolean;
  /** Extra params appended to this screen's share URL. */
  shareParams?: Record<string, string>;
}

export const SCREENS: ScreenDef[] = [
  { name: 'personal', label: 'Personal', chipLabel: 'Push Screen',
    lifecycle: true,  urlPrivileged: false },
  { name: 'commons',  label: 'Commons',  chipLabel: 'Commons Screen',
    lifecycle: false, urlPrivileged: true,  shareParams: { hideChipBar: 'true' } },
];

export const SCREEN_NAMES   = SCREENS.map(s => s.name);
export const LIFECYCLE_SCREEN = SCREENS.find(s => s.lifecycle)!.name; // 'personal'
export const isScreen = (id: string): boolean => SCREEN_NAMES.includes(id);
```

> `party/server.ts` runs in a separate workerd build but can import a leaf module
> with no React/DOM deps. If cross-build import is undesirable, factor just
> `SCREEN_NAMES` + `LIFECYCLE_SCREEN` into `party/screens.ts` (or a `shared/`
> dir) and re-export from `app/screens.ts`. Keep one definition.

## 2. `needsLifecycle` flag

`plugins/types.ts` → `PanelPlugin`, and `app/panelRegistry.ts` → `PanelMeta`:

```ts
/** Requires server lifecycle activation (onActivate). Can only mount on a lifecycle screen. */
needsLifecycle?: boolean;
```

`plugins/soccer/index.ts`: add `needsLifecycle: true`. Nothing else flips today.

A screen can host a panel iff `!panel.needsLifecycle || screen.lifecycle`.

---

## 3. Call-site replacements

### `app/components/apps/ReactionCanvasAppV4.tsx`

```ts
// getUnlockedInterfaces — replace the two hardcoded ifs:
const interfaces = ['personal'];
if (p.get('interface') === 'emcee') interfaces.push('emcee');
for (const s of SCREENS)
  if (s.urlPrivileged && p.get('interface') === s.name) interfaces.push(s.name);

// KNOWN_CHIPS — drop the two hand-written entries:
const KNOWN_CHIPS = {
  ...Object.fromEntries(SCREENS.map(s => [s.name, s.chipLabel])),
  ...Object.fromEntries(PANEL_REGISTRY.map(p => [p.id, p.shortLabel ?? p.label])),
};

// Delete personalScreenPanel / commonsScreenPanel scalars. Derive on demand:
const activeScreenPanel = isScreen(activeInterface)
  ? (screenPanels[activeInterface] ?? 'canvas')
  : null;

// Panel selection IIFE collapses to:
const panelId = isScreen(activeInterface) ? activeScreenPanel
              : activeInterface === 'emcee' ? null
              : activeInterface;

// Participant render guard:
{isScreen(activeInterface) && !PANEL_COMPONENTS[activeScreenPanel!] && (
  <ReactionCanvasParticipant screenName={activeInterface} ... />
)}
```

### `app/components/apps/ReactionCanvasAppV4.tsx` — bug #1 fix folds in here

`screenPanelChanged` already keys by `screenName` ✓. The leak is in
`CursorField`, which has no idea which screen it's rendering. Pass it down:

```ts
<ReactionCanvasParticipant screenName={activeInterface} ... />
//                              ↓ forwards to CursorField
```

### `app/components/shared/CursorField.tsx` (fixes finding #1)

```ts
// new prop
screenName?: string;        // which screen this canvas represents; default 'personal'

// handler — was unconditional:
if (data.type === 'screenPanelChanged') {
  if ((data.screenName ?? 'personal') !== (screenName ?? 'personal')) return; // ignore other screens
  const act = data.screenPanel ?? 'canvas';
  setScreenPanel(act);
  if (data.ball) setBallPos({ x: data.ball.x, y: data.ball.y });
  if (data.screenPanel !== 'soccer') setBallPos(null);
}
// connected handler: read currentScreenPanels[screenName] ?? currentScreenPanel ?? 'canvas'
```

### `app/components/panels/AdminPanelNoDB/tabs/InterfacesTab.tsx`

Header share `<th>` cells → map over `SCREENS`:

```tsx
{SCREENS.map(s => (
  <th key={s.name} style={{ ...thStyle, width: 56, padding: '0 8px 8px' }}>
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
      <span>{s.label}</span>
      <button title={`Share ${s.label} Screen URL`} aria-label={`Share ${s.label} Screen URL`}
              onClick={() => setScreenShareTarget(s.name)} style={shareBtnStyle}>
        {SHARE_ICON}
      </button>
    </div>
  </th>
))}
```

Per-row radio `<td>` cells → map over `SCREENS`, with the lifecycle guard:

```tsx
{SCREENS.map(s => {
  const active   = (screenPanels[s.name] ?? 'canvas') === id;
  const blocked  = needsLifecycle && !s.lifecycle;        // soccer on commons
  const mountable = canScreenMount && !blocked;
  return (
    <td key={s.name} style={{ textAlign:'center', padding:'10px 8px' }}>
      {mountable ? (
        <button onClick={() => sendScreenPanel(s.name, id)}
                aria-pressed={active}
                aria-label={`Switch ${s.label} screen to ${label}`}
                style={{ ...radioBtnStyle, color: active ? '#eee' : '#555' }}>
          {active ? <FaCheckCircle size={14} /> : <FaCircle size={14} />}
        </button>
      ) : (
        <span title={blocked ? `${label} needs an interactive screen` : undefined}
              style={{ color:'#3a3a3a', fontSize:11 }}>—</span>
      )}
    </td>
  );
})}
```

`needsLifecycle` comes from the destructured `PANEL_REGISTRY.map(...)` row.
`screenShareTarget` becomes `string | null`. Share dialog:

```tsx
const screen = SCREENS.find(s => s.name === screenShareTarget)!;
<QRWithCopy url={getScreenUrl(screen.name, screen.shareParams)} />
```

Cleanup #6 — collapse `getScreenUrl`/`getPatchUrl` into one builder:

```ts
function buildInterfaceUrl(set: Record<string,string>, opts?: { keepPatchParams?: boolean }) {
  const p = new URLSearchParams(window.location.search);
  ['forceView','admin','addInterface'].forEach(k => p.delete(k));
  for (const [k,v] of Object.entries(set)) p.set(k, v);
  const qs = p.toString();
  return `${location.origin}${location.pathname}${qs ? `?${qs}` : ''}${location.hash}`;
}
// getScreenUrl(name, extra) -> buildInterfaceUrl({ interface: name, ...extra })
// getPatchUrl keeps its userId/selfChain logic, then calls buildInterfaceUrl.
```

### `party/server.ts`

```ts
import { LIFECYCLE_SCREEN } from './screens';        // or shared module

private handleSetScreenPanel(event: SetScreenPanelEvent): void {
  const screenName = event.screenName ?? 'personal';
  const prevPanel  = this.screenPanelsByName[screenName] ?? 'canvas';
  this.screenPanelsByName[screenName] = event.screenPanel;
  const ctx = this.makePluginContext();

  // Lifecycle fires only for the lifecycle screen. Defensive: a needsLifecycle
  // panel pushed onto any other screen is a client bug — ignore its activation.
  if (screenName === LIFECYCLE_SCREEN) {
    PLUGIN_MAP[prevPanel]?.server?.onDeactivate(ctx, this.pluginStates.get(prevPanel));
    PLUGIN_MAP[event.screenPanel]?.server?.onActivate(ctx, this.pluginStates.get(event.screenPanel));
  }
  // ...broadcast unchanged (ball still keyed off the lifecycle/personal panel)
}
```

The `screenPanelsByName['personal'] ?? 'canvas'` repetitions become
`screenPanelsByName[LIFECYCLE_SCREEN] ?? 'canvas'` — same value, named intent.
Seed the map with both screens for a complete `currentScreenPanels` snapshot:
`{ personal: 'canvas', commons: 'canvas' }` (or `Object.fromEntries(SCREEN_NAMES.map(n => [n, 'canvas']))`).

---

## 4. What this buys

- 3rd screen = **one `SCREENS` entry**. No edits to render logic, chips, columns,
  share dialog, or unlock logic.
- `soccer`-on-`commons` is now **impossible in the UI** (dimmed `—` with tooltip)
  and **defended on the server** — the "lifecycle only on personal" gate is now a
  consequence of a declared rule, not a silent special-case.
- Bug #1 (CursorField cross-screen corruption) is fixed structurally: the canvas
  knows its own `screenName` and ignores other screens' broadcasts.
- ~2 copy-pasted `<th>`/`<td>` blocks, 2 parallel scalars, and the duplicate URL
  builder all collapse.

## 5. Out of scope (deliberately)

True per-screen plugin lifecycle (e.g. soccer running independently on *both*
screens at once) needs per-screen plugin **state**, since plugin state is a single
global instance today. `needsLifecycle` sidesteps that entirely: only the one
lifecycle screen may host such panels, so single-instance state stays correct.
Revisit only if a second interactive panel ever needs to run on commons.
