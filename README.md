# Polislike Reaction Canvas

A real-time collaborative voting canvas built on [PartyKit](https://partykit.io) (WebSockets) and React. Participants drag or touch their cursor into **Agree / Disagree / Pass** regions of a shared canvas; positions are broadcast live so everyone can see collective reactions in real time.

## Goals

- Prototype an interface for collecting vote data at synchronous events
- Enable participation without looking at your phone
- Use presence to make data collection feel collective
- Provide an admin interface for selecting statements and reviewing reactions

## Non-Goals

- No security or authentication of vote data
- No dimensional reduction on vote data
- No scalable production database

---

## Modes

### V1 — Statement Voting

Participants vote on a queue of [Polis](https://pol.is) statements. A countdown bar shows time remaining on the active statement; votes are submitted automatically on transition. Admin panel manages the statement queue.

| Participation | Statement Admin |
|:---:|:---:|
| ![V1 participation](https://picsum.photos/seed/v1-participation/320/568) | ![V1 admin](https://picsum.photos/seed/v1-admin/600/400) |

**URL:** `/#v1` · `/?admin=true#v1` for admin

---

### V2 — YouTube Multiplayer (Sync)

A YouTube video plays in the top half of the screen; the reaction canvas sits below. Playback is gated — the video only plays when all present participants are actively touching the canvas, creating a synchronised group-watch experience.

| Participation |
|:---:|
| ![V2 participation](https://picsum.photos/seed/v2-participation/320/568) |

**URL:** `/?videoId=<youtube-id>#v2`

---

### V4 — Live Event

A standalone reaction canvas designed for live events. Labels and anchor positions are configurable in real time from the admin panel and broadcast to all participants instantly. Admin panel also controls recording of cursor data.

| Participation | Recording Admin |
|:---:|:---:|
| ![V4 participation](https://picsum.photos/seed/v4-participation/320/568) | ![V4 admin](https://picsum.photos/seed/v4-admin/600/400) |

**URL:** `/#v4` · `/?admin=true#v4` for admin

---

### Future — YouTube Multiplayer (Async)

_Coming soon._ Each participant watches and reacts independently; reactions are timestamped against the video so responses can be replayed and compared across viewers.

| Participation |
|:---:|
| _Coming soon_ |

---

## Dev

```bash
npm run dev        # PartyKit dev server on localhost:1999
npm run storybook  # Storybook on localhost:6006
npm run deploy     # Deploy to PartyKit (commits required first)
```

See [`CLAUDE.md`](./CLAUDE.md) for full architecture notes and deploy rules.

## Stack

- [React](https://react.dev)
- [PartyKit](https://partykit.io) — WebSockets / serverless edge
- [D3](https://d3js.org) — SVG canvas rendering
- [Storybook](https://storybook.js.org) — component development
