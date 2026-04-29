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

const GRAPHQL_URL = 'https://guild.host/graphql/ab910738acdb79ffade614553f55523137c6968924e004a2e789faef52c0c081';

function extractSlug(eventUrl: string): string | null {
  try {
    const path = new URL(eventUrl).pathname;
    const segments = path.split('/').filter(Boolean);
    const lastSegment = segments[segments.length - 1];
    if (!lastSegment) return null;
    // The API slug is the last hyphen-separated token (e.g. "civic-meetup-540-numbers-3onf9n" → "3onf9n")
    const parts = lastSegment.split('-');
    return parts[parts.length - 1] ?? null;
  } catch {
    return null;
  }
}

type AttendeeEdge = {
  cursor: string;
  node: {
    user: {
      slugId: string;
      firstName: string;
      lastName: string;
      primaryPhoto: { transformUrl: string } | null;
      defaultAvatarUrl: string;
    };
  };
};

async function fetchPage(slug: string, after?: string): Promise<{ edges: AttendeeEdge[]; hasNextPage: boolean }> {
  const vars: Record<string, unknown> = { slug };
  if (after) vars.after = after;
  const res = await fetch(GRAPHQL_URL, {
    headers: { 'x-gqlvars': JSON.stringify(vars) },
  });
  if (!res.ok) throw new Error(`Guild API returned ${res.status}`);
  const json = await res.json();
  const attendees = json?.data?.event?.inPersonAttendees;
  const edges: AttendeeEdge[] = attendees?.edges ?? [];
  const hasNextPage: boolean = attendees?.pageInfo?.hasNextPage ?? (edges.length > 0 && edges.length === 10);
  return { edges, hasNextPage };
}

async function fetchAttendees(slug: string): Promise<Attendee[]> {
  const all: Attendee[] = [];
  let after: string | undefined;

  for (;;) {
    const { edges, hasNextPage } = await fetchPage(slug, after);
    for (const { cursor, node: { user } } of edges) {
      all.push({
        slugId: user.slugId,
        firstName: user.firstName,
        lastName: user.lastName,
        photoUrl: user.primaryPhoto?.transformUrl ?? user.defaultAvatarUrl,
      });
      after = cursor;
    }
    if (!hasNextPage || edges.length === 0) break;
  }

  return all;
}

export default function GreeterPanel({ greeterConfig }: GreeterPanelProps) {
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');

  const slug = greeterConfig ? extractSlug(greeterConfig.eventUrl) : null;

  useEffect(() => {
    if (!slug) {
      setAttendees([]);
      setStatus('idle');
      return;
    }
    setStatus('loading');
    fetchAttendees(slug)
      .then(list => { setAttendees(list); setStatus('idle'); })
      .catch(() => setStatus('error'));
  }, [slug]);

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
        {!greeterConfig || !slug ? (
          <p style={{ color: '#555', fontSize: 13, padding: '16px 20px' }}>No event URL configured yet.</p>
        ) : status === 'loading' ? (
          <p style={{ color: '#555', fontSize: 13, padding: '16px 20px' }}>Loading attendees…</p>
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
