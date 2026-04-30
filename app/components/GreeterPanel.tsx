import { useState, useEffect } from "react";
import type { GreeterConfig } from "../types";

interface Attendee {
  slugId: string;
  firstName: string;
  lastName: string;
  photoUrl: string;
}

interface EventInfo {
  id: string;
  name: string;
  startAt: string;
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
      const parts = segments[1].split('-');
      return { type: 'event', slug: parts[parts.length - 1] };
    }
    if (segments.length === 1) {
      return { type: 'group', groupSlug: segments[0] };
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchEventBySlug(slug: string): Promise<EventInfo | null> {
  const res = await fetch(GRAPHQL_SLUG_URL, {
    headers: { 'x-gqlvars': JSON.stringify({ slug }) },
  });
  if (!res.ok) return null;
  const json = await res.json();
  const e = json?.data?.event;
  if (!e?.id) return null;
  return { id: e.id, name: e.name ?? '', startAt: e.startAt ?? '' };
}

type EventsPage = { events: EventInfo[]; hasMore: boolean; endCursor: string | null };

async function fetchEventsList(groupSlug: string, endpoint: 'upcoming' | 'past', after?: string): Promise<EventsPage> {
  const url = new URL(`https://guild.host/api/next/${groupSlug}/events/${endpoint}`);
  if (after) url.searchParams.set('after', after);
  const res = await fetch(url.toString());
  if (!res.ok) return { events: [], hasMore: false, endCursor: null };
  const json = await res.json();
  const edges: { node: { id: string; name: string; startAt: string } }[] = json?.events?.edges ?? [];
  return {
    events: edges.map(e => ({ id: e.node.id, name: e.node.name, startAt: e.node.startAt })),
    hasMore: json?.events?.pageInfo?.hasNextPage ?? false,
    endCursor: json?.events?.pageInfo?.endCursor ?? null,
  };
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

function formatDate(iso: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '';
  }
}

export default function GreeterPanel({ greeterConfig }: GreeterPanelProps) {
  const [events, setEvents] = useState<EventInfo[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hasMorePast, setHasMorePast] = useState(false);
  const [pastEndCursor, setPastEndCursor] = useState<string | null>(null);
  const [groupSlug, setGroupSlug] = useState<string | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [listStatus, setListStatus] = useState<'idle' | 'loading' | 'no-event' | 'error'>('idle');
  const [attendeeStatus, setAttendeeStatus] = useState<'idle' | 'loading' | 'error'>('idle');

  const eventUrl = greeterConfig?.eventUrl ?? null;

  // Load event list when URL changes
  useEffect(() => {
    if (!eventUrl) {
      setEvents([]); setCurrentIndex(0); setGroupSlug(null); setListStatus('idle');
      return;
    }
    const parsed = parseGuildUrl(eventUrl);
    if (!parsed) {
      setEvents([]); setCurrentIndex(0); setGroupSlug(null); setListStatus('idle');
      return;
    }

    let cancelled = false;
    setListStatus('loading');
    setEvents([]);
    setGroupSlug(null);

    if (parsed.type === 'event') {
      fetchEventBySlug(parsed.slug).then(event => {
        if (cancelled) return;
        if (!event) { setListStatus('no-event'); return; }
        setEvents([event]);
        setCurrentIndex(0);
        setListStatus('idle');
      }).catch(() => { if (!cancelled) setListStatus('error'); });
    } else {
      const slug = parsed.groupSlug;
      Promise.all([
        fetchEventsList(slug, 'upcoming'),
        fetchEventsList(slug, 'past'),
      ]).then(([upcoming, past]) => {
        if (cancelled) return;
        // past is newest-first; reverse to get chronological order for merging
        const allEvents = [...[...past.events].reverse(), ...upcoming.events];
        // Deduplicate by id in case cursors overlap
        const seen = new Set<string>();
        const deduped = allEvents.filter(e => { if (seen.has(e.id)) return false; seen.add(e.id); return true; });
        if (deduped.length === 0) { setListStatus('no-event'); return; }
        setEvents(deduped);
        setHasMorePast(past.hasMore);
        setPastEndCursor(past.endCursor);
        setGroupSlug(slug);
        // Default to first upcoming; fall back to most recent past
        const idx = upcoming.events.length > 0 ? past.events.length : past.events.length - 1;
        setCurrentIndex(Math.max(0, idx));
        setListStatus('idle');
      }).catch(() => { if (!cancelled) setListStatus('error'); });
    }

    return () => { cancelled = true; };
  }, [eventUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch attendees when current event changes
  const currentEventId = events[currentIndex]?.id ?? null;
  useEffect(() => {
    if (!currentEventId) { setAttendees([]); return; }
    let cancelled = false;
    setAttendeeStatus('loading');
    fetchAttendees(currentEventId)
      .then(list => { if (!cancelled) { setAttendees(list); setAttendeeStatus('idle'); } })
      .catch(() => { if (!cancelled) setAttendeeStatus('error'); });
    return () => { cancelled = true; };
  }, [currentEventId]);

  const handlePrev = async () => {
    if (currentIndex > 0) {
      setCurrentIndex(i => i - 1);
    } else if (hasMorePast && groupSlug && pastEndCursor) {
      const more = await fetchEventsList(groupSlug, 'past', pastEndCursor);
      const reversed = [...more.events].reverse();
      if (reversed.length === 0) return;
      setEvents(prev => {
        const seen = new Set(prev.map(e => e.id));
        const fresh = reversed.filter(e => !seen.has(e.id));
        return [...fresh, ...prev];
      });
      setHasMorePast(more.hasMore);
      setPastEndCursor(more.endCursor);
      setCurrentIndex(reversed.length - 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < events.length - 1) setCurrentIndex(i => i + 1);
  };

  const canGoPrev = currentIndex > 0 || hasMorePast;
  const canGoNext = currentIndex < events.length - 1;
  const currentEvent = events[currentIndex] ?? null;
  const isGroupMode = groupSlug !== null;

  type SortMode = 'none' | 'first' | 'last';
  const [sortMode, setSortMode] = useState<SortMode>('none');
  const SORT_LABELS: Record<SortMode, string> = { none: 'Sort', first: 'First', last: 'Last' };
  const SORT_CYCLE: SortMode[] = ['none', 'first', 'last'];

  const sortedAttendees = sortMode === 'none' ? attendees : [...attendees].sort((a, b) => {
    const key = sortMode === 'first' ? 'firstName' : 'lastName';
    return a[key].localeCompare(b[key]);
  });

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#0f0f0e', color: '#ccc', fontFamily: 'monospace', overflow: 'hidden' }}>

      <div style={{ padding: '12px 20px 8px', borderBottom: '1px solid #222', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isGroupMode && (
            <button
              onClick={handlePrev}
              disabled={!canGoPrev}
              style={{ background: 'none', border: 'none', color: canGoPrev ? '#aaa' : '#333', cursor: canGoPrev ? 'pointer' : 'default', padding: '0 4px', fontSize: 16, lineHeight: 1, flexShrink: 0 }}
              aria-label="Previous event"
            >
              ←
            </button>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#eee', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {currentEvent?.name || 'In-Person Attendees'}
            </div>
            {currentEvent?.startAt && (
              <div style={{ fontSize: 11, color: '#666', marginTop: 1 }}>{formatDate(currentEvent.startAt)}</div>
            )}
          </div>
          {isGroupMode && (
            <button
              onClick={handleNext}
              disabled={!canGoNext}
              style={{ background: 'none', border: 'none', color: canGoNext ? '#aaa' : '#333', cursor: canGoNext ? 'pointer' : 'default', padding: '0 4px', fontSize: 16, lineHeight: 1, flexShrink: 0 }}
              aria-label="Next event"
            >
              →
            </button>
          )}
          {attendees.length > 0 && attendeeStatus === 'idle' && (<>
            <button
              onClick={() => setSortMode(m => SORT_CYCLE[(SORT_CYCLE.indexOf(m) + 1) % SORT_CYCLE.length])}
              style={{ background: 'none', border: 'none', color: sortMode === 'none' ? '#555' : '#aaa', cursor: 'pointer', fontSize: 11, padding: '2px 4px', flexShrink: 0 }}
              title="Toggle sort order"
            >
              {SORT_LABELS[sortMode]} ↑
            </button>
            <span style={{ fontSize: 12, color: '#555', flexShrink: 0 }}>{attendees.length}</span>
          </>)}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {!greeterConfig || !eventUrl ? (
          <p style={{ color: '#555', fontSize: 13, padding: '16px 20px' }}>No URL configured yet.</p>
        ) : listStatus === 'loading' ? (
          <p style={{ color: '#555', fontSize: 13, padding: '16px 20px' }}>Loading…</p>
        ) : listStatus === 'no-event' ? (
          <p style={{ color: '#555', fontSize: 13, padding: '16px 20px' }}>No events found.</p>
        ) : listStatus === 'error' ? (
          <p style={{ color: '#a44', fontSize: 13, padding: '16px 20px' }}>Failed to load events.</p>
        ) : attendeeStatus === 'loading' ? (
          <p style={{ color: '#555', fontSize: 13, padding: '16px 20px' }}>Loading attendees…</p>
        ) : attendeeStatus === 'error' ? (
          <p style={{ color: '#a44', fontSize: 13, padding: '16px 20px' }}>Failed to load attendees.</p>
        ) : attendees.length === 0 ? (
          <p style={{ color: '#555', fontSize: 13, padding: '16px 20px' }}>No in-person attendees found.</p>
        ) : (
          sortedAttendees.map(a => (
            <div key={a.slugId} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 20px' }}>
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
