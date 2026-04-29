import { useState, useEffect } from "react";
import type { GreeterConfig } from "../types";

interface Attendee {
  slugId: string;
  firstName: string;
  lastName: string;
  photoUrl: string;
}

interface GreeterPanelProps {
  greeterConfig: GreeterConfig | null;
}

const GRAPHQL_SLUG_URL = 'https://guild.host/graphql/ab910738acdb79ffade614553f55523137c6968924e004a2e789faef52c0c081';
const GRAPHQL_ATTENDEES_URL = 'https://guild.host/graphql/f0f0595e0c3bc689857cd75b6e3d1e32de52fa6aeeb3671a69aa1b9e0986c5e0';

type ParsedUrl =
  | { type: 'event'; slug: string }
  | { type: 'group'; groupSlug: string };

function parseGuildUrl(url: string): ParsedUrl | null {
  try {
    const segments = new URL(url).pathname.split('/').filter(Boolean);
    if (segments[0] === 'events' && segments[1]) {
      // e.g. /events/civic-meetup-540-numbers-3onf9n → slug = "3onf9n"
      const parts = segments[1].split('-');
      return { type: 'event', slug: parts[parts.length - 1] };
    }
    if (segments.length === 1) {
      // e.g. /civic-tech-toronto
      return { type: 'group', groupSlug: segments[0] };
    }
    return null;
  } catch {
    return null;
  }
}

async function resolveEventNodeId(parsed: ParsedUrl): Promise<string | null> {
  if (parsed.type === 'event') {
    const res = await fetch(GRAPHQL_SLUG_URL, {
      headers: { 'x-gqlvars': JSON.stringify({ slug: parsed.slug }) },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data?.event?.id ?? null;
  } else {
    const res = await fetch(`https://guild.host/api/next/${parsed.groupSlug}/events/upcoming`);
    if (!res.ok) return null;
    const json = await res.json();
    return json?.events?.edges?.[0]?.node?.id ?? null;
  }
}

async function fetchAttendees(nodeId: string): Promise<Attendee[]> {
  const res = await fetch(GRAPHQL_ATTENDEES_URL, {
    headers: {
      'content-type': 'application/json',
      'x-gqlvars': JSON.stringify({ id: nodeId, count: 200 }),
    },
  });
  if (!res.ok) throw new Error(`Guild API returned ${res.status}`);
  const json = await res.json();
  const edges: { node: { user: { slugId: string; firstName: string; lastName: string; primaryPhoto: { transformUrl: string } | null; defaultAvatarUrl: string } } }[] =
    json?.data?.node?.inPersonAttendees?.edges ?? [];
  return edges.map(({ node: { user } }) => ({
    slugId: user.slugId,
    firstName: user.firstName,
    lastName: user.lastName,
    photoUrl: user.primaryPhoto?.transformUrl ?? user.defaultAvatarUrl,
  }));
}

export default function GreeterPanel({ greeterConfig }: GreeterPanelProps) {
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'no-event' | 'error'>('idle');

  const eventUrl = greeterConfig?.eventUrl ?? null;

  useEffect(() => {
    if (!eventUrl) {
      setAttendees([]);
      setStatus('idle');
      return;
    }

    const parsed = parseGuildUrl(eventUrl);
    if (!parsed) {
      setAttendees([]);
      setStatus('idle');
      return;
    }

    let cancelled = false;
    setStatus('loading');

    resolveEventNodeId(parsed)
      .then(nodeId => {
        if (cancelled) return;
        if (!nodeId) { setStatus('no-event'); return; }
        return fetchAttendees(nodeId).then(list => {
          if (!cancelled) { setAttendees(list); setStatus('idle'); }
        });
      })
      .catch(() => { if (!cancelled) setStatus('error'); });

    return () => { cancelled = true; };
  }, [eventUrl]);

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      background: '#0f0f0e',
      color: '#ccc',
      fontFamily: 'monospace',
      overflow: 'hidden',
    }}>
      <div style={{ padding: '16px 20px 8px', borderBottom: '1px solid #222', flexShrink: 0 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#eee' }}>In-Person Attendees</span>
        {attendees.length > 0 && (
          <span style={{ fontSize: 12, color: '#555', marginLeft: 8 }}>{attendees.length}</span>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {!greeterConfig || !eventUrl ? (
          <p style={{ color: '#555', fontSize: 13, padding: '16px 20px' }}>No URL configured yet.</p>
        ) : status === 'loading' ? (
          <p style={{ color: '#555', fontSize: 13, padding: '16px 20px' }}>Loading attendees…</p>
        ) : status === 'no-event' ? (
          <p style={{ color: '#555', fontSize: 13, padding: '16px 20px' }}>No upcoming event found for this group.</p>
        ) : status === 'error' ? (
          <p style={{ color: '#a44', fontSize: 13, padding: '16px 20px' }}>Failed to load attendees.</p>
        ) : attendees.length === 0 ? (
          <p style={{ color: '#555', fontSize: 13, padding: '16px 20px' }}>No in-person attendees found.</p>
        ) : (
          attendees.map(a => (
            <div
              key={a.slugId}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 20px' }}
            >
              <img
                src={a.photoUrl}
                alt={`${a.firstName} ${a.lastName}`}
                width={36}
                height={36}
                style={{ borderRadius: '50%', flexShrink: 0, background: '#222' }}
              />
              <span style={{ fontSize: 14, color: '#ddd' }}>{a.firstName} {a.lastName}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
