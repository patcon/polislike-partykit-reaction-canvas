# Routing & URL Params

Hash-based routing, managed in `App` in `client.tsx`:

| Hash | Component | Notes |
|------|-----------|-------|
| *(none)* | `IndexApp` | Landing page with app cards |
| `#v2` | `ReactionCanvasAppV2` | YouTube embed + realtime reaction canvas |
| `#v3` | *(redirect)* | Redirects to `#v4` |
| `#v4` | `ReactionCanvasAppV4` | Full-page canvas, no video, live recording via JSON download |
| `#v5` | `ReactionCanvasAppV5` | YouTube async + Supabase-backed recording + replay |

URL params are read by each sub-app independently. `?room=` is the canonical way to set the PartyKit room for all versions. In YouTube-style apps (V2/V5), `?room=` also doubles as the YouTube video ID. `?videoId=` is a deprecated alias for `?room=`. Do **not** use `replaceState` to normalise URL params — it breaks the browser back button.

## V1 URL params

| Param | Values | Effect |
|-------|--------|--------|
| `room` | string | PartyKit room name; defaults to `"default"` |
| `admin` | `true` | Renders `AdminPanel` instead of the voting canvas |
| `ghostCursors` | `true`/`false` | Enables/disables 10 simulated ghost cursors |

## V2 URL params

| Param | Values | Effect |
|-------|--------|--------|
| `room` | YouTube video ID | Sets the PartyKit room **and** the YouTube video to embed; shows placeholder if omitted |
| `labels` | preset key or base64 custom | Selects a reaction label preset; falls back to localStorage / `default` if omitted |
| `forceView` | `mobile` | Bypasses the mobile-only QR gate; shows the canvas on desktop |
| `videoId` | YouTube video ID | **Deprecated** alias for `room`; still works for backward compatibility |

## V4 URL params

| Param | Values | Effect |
|-------|--------|--------|
| `room` | string | PartyKit room name; defaults to `"default"` |
| `labels` | preset key or base64 custom | Selects a reaction label preset; falls back to localStorage / `default` if omitted |
| `forceView` | `mobile` | Bypasses the mobile-only QR gate; shows the canvas on desktop |
| `interface` | `emcee` \| `commons` | Unlocks the named interface/screen chip (URL-privileged, parallel to `addInterface`); shows chip bar. `emcee` defaults to the emcee panel; `commons` unlocks the shared Commons screen |
| `hideChipBar` | `true` | Hides the chip bar for single-screen fullscreen displays (e.g. a wall-mounted Commons screen) |
| `admin` | `true` | **Deprecated** alias for `?interface=emcee`; still works for backward compatibility |

## V5 URL params

| Param | Values | Effect |
|-------|--------|--------|
| `room` | YouTube video ID | Sets the PartyKit room **and** the YouTube video to embed |
| `labels` | preset key or base64 custom | Selects a reaction label preset; falls back to localStorage / `default` if omitted |
| `forceView` | `mobile` | Bypasses the mobile-only QR gate; shows the canvas on desktop |
| `admin` | `true` | Renders `AdminPanelV5` for managing Supabase-backed reaction data |
