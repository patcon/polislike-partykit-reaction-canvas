# Supabase Setup for V5

V5 records participant touch events to Supabase so they can be replayed asynchronously in sync with the video timecode.

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a free project.
2. Wait for the project to finish provisioning.

## 2. Create the Table

Open the **SQL Editor** in your Supabase dashboard and run:

```sql
CREATE TABLE reaction_events (
  id          BIGSERIAL PRIMARY KEY,
  room        TEXT    NOT NULL,
  session_id  TEXT    NOT NULL,
  type        TEXT    NOT NULL,   -- 'touch' | 'move' | 'lift'
  x           REAL,
  y           REAL,
  timecode    REAL    NOT NULL,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON reaction_events (room);
```

> **RLS note:** Row-Level Security is disabled for this table. The anon key is safe to expose in client code — the table is append-only and world-readable by design.

## 3. Get Your Credentials

In the Supabase dashboard, go to **Settings → API** and copy:

- **Project URL** (e.g. `https://xyzxyz.supabase.co`)
- **anon / public** key (the long `eyJ…` string)

## 4. Configure Environment Variables

### For Local Dev

Update `partykit.json` to replace the placeholder empty strings with your actual values in the `serve.build.define` section:

```json
"define": {
  "process.env.PARTYKIT_HOST": "'polislike-partykit-reaction-canvas.patcon.partykit.dev'",
  "process.env.PARTYKIT_SUPABASE_URL": "'https://your-project.supabase.co'",
  "process.env.PARTYKIT_SUPABASE_ANON_KEY": "'eyJ...your-anon-key...'"
}
```

These values are bundled into the client-side JavaScript at build time. The anon key is safe to include since it only grants access to the `reaction_events` table and RLS is intentionally permissive.

### For PartyKit Deploy

Add secrets via the PartyKit CLI so they are available during the production build:

```bash
npx partykit env add PARTYKIT_SUPABASE_URL
npx partykit env add PARTYKIT_SUPABASE_ANON_KEY
```

Then update `partykit.json` to reference the secrets in the define block:

```json
"define": {
  "process.env.PARTYKIT_SUPABASE_URL": "PARTYKIT_SUPABASE_URL",
  "process.env.PARTYKIT_SUPABASE_ANON_KEY": "PARTYKIT_SUPABASE_ANON_KEY"
}
```

> **Note:** Until Supabase credentials are configured, V5 will load and run but Supabase calls will fail silently — no events will be saved or replayed.

## Schema Reference

| Column | Type | Description |
|--------|------|-------------|
| `id` | `BIGSERIAL` | Auto-incrementing primary key |
| `room` | `TEXT` | PartyKit room name (= YouTube video ID in V5) |
| `session_id` | `TEXT` | Random ID generated per browser session |
| `type` | `TEXT` | `touch` (finger/cursor down), `move` (dragging), or `lift` (finger/cursor up) |
| `x` | `REAL` | Normalized X position (0–100), `NULL` for `lift` events |
| `y` | `REAL` | Normalized Y position (0–100), `NULL` for `lift` events |
| `timecode` | `REAL` | Video timecode in seconds at the moment of the event |
| `recorded_at` | `TIMESTAMPTZ` | Wall-clock time of the insert (auto-set by Supabase) |
