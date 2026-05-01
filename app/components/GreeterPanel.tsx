import { useState, useEffect } from "react";
import type { GreeterConfig } from "../types";
import GreeterQuizMode, { type QuizMode } from "./GreeterQuizMode";

interface Attendee {
  slugId: string;
  firstName: string;
  lastName: string;
  photoUrl: string;
  hasRealPhoto: boolean;
  attendance: 'in-person' | 'online';
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
const GRAPHQL_IN_PERSON_URL = 'https://guild.host/graphql/f0f0595e0c3bc689857cd75b6e3d1e32de52fa6aeeb3671a69aa1b9e0986c5e0';
const GRAPHQL_ONLINE_URL = 'https://guild.host/graphql/1214f0d979f864bf430feb6f62c155cd533b3c8084ade0e530f31c1d76cf4ac4';

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

async function fetchAttendeesByType(nodeId: string, attendance: Attendee['attendance']): Promise<Attendee[]> {
  const url = attendance === 'in-person' ? GRAPHQL_IN_PERSON_URL : GRAPHQL_ONLINE_URL;
  const res = await fetch(url, {
    headers: {
      'content-type': 'application/json',
      'x-gqlvars': JSON.stringify({ id: nodeId, count: 200 }),
    },
  });
  if (!res.ok) throw new Error(`Guild API returned ${res.status}`);
  const json = await res.json();
  const key = attendance === 'in-person' ? 'inPersonAttendees' : 'onlineAttendees';
  const edges: { node: { user: { slugId: string; firstName: string; lastName: string; primaryPhoto: { transformUrl: string } | null; defaultAvatarUrl: string } } }[] =
    json?.data?.node?.[key]?.edges ?? [];
  return edges.map(({ node: { user } }) => ({
    slugId: user.slugId,
    firstName: user.firstName,
    lastName: user.lastName,
    photoUrl: user.primaryPhoto?.transformUrl ?? user.defaultAvatarUrl,
    hasRealPhoto: user.primaryPhoto !== null,
    attendance,
  }));
}

async function fetchAllAttendees(nodeId: string): Promise<Attendee[]> {
  const [inPerson, online] = await Promise.all([
    fetchAttendeesByType(nodeId, 'in-person'),
    fetchAttendeesByType(nodeId, 'online'),
  ]);
  return [...inPerson, ...online];
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
        // Default: first upcoming, or most recent past if none
        let idx = upcoming.events.length > 0 ? past.events.length : past.events.length - 1;
        // Override: if any event starts today, prefer the last such event (stays "current" until midnight)
        const today = new Date().toLocaleDateString('en-CA');
        for (let i = deduped.length - 1; i >= 0; i--) {
          try {
            if (deduped[i].startAt && new Date(deduped[i].startAt).toLocaleDateString('en-CA') === today) {
              idx = i;
              break;
            }
          } catch { /* skip */ }
        }
        setCurrentIndex(Math.max(0, idx));
        setListStatus('idle');
      }).catch(() => { if (!cancelled) setListStatus('error'); });
    }

    return () => { cancelled = true; };
  }, [eventUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  type FilterMode = 'in-person' | 'online' | 'all';
  const [filterMode, setFilterMode] = useState<FilterMode>('in-person');
  const FILTER_LABELS: Record<FilterMode, string> = { 'in-person': 'In-person', 'online': 'Online', 'all': 'All' };
  const FILTER_CYCLE: FilterMode[] = ['in-person', 'online', 'all'];

  // Fetch attendees when current event changes
  const currentEventId = events[currentIndex]?.id ?? null;
  useEffect(() => {
    if (!currentEventId) { setAttendees([]); return; }
    let cancelled = false;
    setAttendeeStatus('loading');
    fetchAllAttendees(currentEventId)
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

  // Session-level quiz state (persists across event navigation within the same tab)
  const [memorizedByKey, setMemorizedByKey] = useState<Record<string, Set<string>>>({});
  const [quizMode, setQuizMode] = useState<QuizMode>('image-name');
  const [quizReversed, setQuizReversed] = useState(false);
  const [hideDefaultAvatars, setHideDefaultAvatars] = useState(true);
  const [quizActive, setQuizActive] = useState(false);

  // Close quiz when switching events (but preserve memorizedByKey)
  useEffect(() => {
    setQuizActive(false);
  }, [currentEventId]);

  const quizKey = `${quizMode}:${quizReversed ? 'reverse' : 'forward'}`;
  const memorizedIds = memorizedByKey[quizKey] ?? new Set<string>();

  const handleMemorize = (slugId: string) => {
    setMemorizedByKey(prev => {
      const existing = prev[quizKey] ?? new Set<string>();
      return { ...prev, [quizKey]: new Set([...existing, slugId]) };
    });
  };

  const filteredAttendees = filterMode === 'all' ? attendees : attendees.filter(a => a.attendance === filterMode);
  const sortedAttendees = sortMode === 'none' ? filteredAttendees : [...filteredAttendees].sort((a, b) => {
    const key = sortMode === 'first' ? 'firstName' : 'lastName';
    return a[key].localeCompare(b[key]);
  });

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#0f0f0e', color: '#ccc', fontFamily: 'monospace', overflow: 'hidden' }}>

      <div style={{ padding: '12px 20px 0', borderBottom: '1px solid #222', flexShrink: 0 }}>
        {/* Row 1: event navigator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 8 }}>
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
        </div>
        {/* Row 2: sort · filter · count */}
        {attendees.length > 0 && attendeeStatus === 'idle' && (
          <div style={{ display: 'flex', alignItems: 'center', paddingBottom: 8, borderTop: '1px solid #1a1a1a' }}>
            <button
              onClick={() => setSortMode(m => SORT_CYCLE[(SORT_CYCLE.indexOf(m) + 1) % SORT_CYCLE.length])}
              style={{ background: 'none', border: 'none', color: sortMode === 'none' ? '#555' : '#aaa', cursor: 'pointer', fontSize: 11, padding: '6px 8px', flexShrink: 0, minWidth: 64, textAlign: 'center', marginLeft: 'auto' }}
              title="Toggle sort order"
            >
              {SORT_LABELS[sortMode]} ↑
            </button>
            <button
              onClick={() => setFilterMode(m => FILTER_CYCLE[(FILTER_CYCLE.indexOf(m) + 1) % FILTER_CYCLE.length])}
              style={{ background: 'none', border: 'none', color: filterMode === 'all' ? '#555' : '#aaa', cursor: 'pointer', fontSize: 11, padding: '6px 8px', flexShrink: 0, minWidth: 80, textAlign: 'center' }}
              title="Toggle attendance filter"
            >
              {FILTER_LABELS[filterMode]}
            </button>
            <span style={{ fontSize: 12, color: '#555', padding: '6px 8px', minWidth: 36, textAlign: 'right', display: 'inline-block' }}>{filteredAttendees.length}</span>
          </div>
        )}
      </div>

      {quizActive ? (
        <GreeterQuizMode
          attendees={filteredAttendees}
          memorizedIds={memorizedIds}
          onMemorize={handleMemorize}
          onExit={() => setQuizActive(false)}
          quizMode={quizMode}
          onQuizModeChange={setQuizMode}
          reversed={quizReversed}
          onReverseChange={setQuizReversed}
          hideDefaultAvatars={hideDefaultAvatars}
          onHideDefaultAvatarsChange={setHideDefaultAvatars}
        />
      ) : (
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
      )}

      {/* Quiz button: sticky footer, only in list mode with attendees loaded */}
      {!quizActive && attendeeStatus === 'idle' && attendees.length > 0 && (
        <div style={{ flexShrink: 0, padding: '10px 20px 24px', borderTop: '1px solid #1a1a1a' }}>
          <button
            onClick={() => setQuizActive(true)}
            style={{ width: '100%', background: '#1a1a1a', border: '1px solid #333', borderRadius: 6, color: '#aaa', cursor: 'pointer', fontFamily: 'monospace', fontSize: 13, padding: '8px 16px' }}
          >
            Quiz Yourself
          </button>
        </div>
      )}
    </div>
  );
}
