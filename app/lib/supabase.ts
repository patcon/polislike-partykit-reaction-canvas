import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

// process.env.* is replaced at build time by partykit.json define.
// When secrets are not configured (local dev), the substituted identifier
// is undeclared — ReferenceError. try/catch handles that gracefully.
let SUPABASE_URL = '';
let SUPABASE_ANON_KEY = '';
try {
  SUPABASE_URL = process.env.PARTYKIT_SUPABASE_URL ?? '';
  SUPABASE_ANON_KEY = process.env.PARTYKIT_SUPABASE_ANON_KEY ?? '';
} catch {
  // Supabase credentials not configured; all calls will be no-ops.
}

// Only create the client if both values are present; createClient('') throws.
const supabase: SupabaseClient | null =
  SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

export const isSupabaseConfigured = supabase !== null;

export interface ReactionEvent {
  id?: number;
  room: string;
  session_id: string;
  type: 'touch' | 'move' | 'lift';
  x: number | null;
  y: number | null;
  timecode: number;
  recorded_at?: string;
}

export async function insertEvent(event: Omit<ReactionEvent, 'id' | 'recorded_at'>) {
  if (!supabase) return;
  return supabase.from('reaction_events').insert(event);
}

export async function fetchEvents(room: string): Promise<ReactionEvent[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('reaction_events')
    .select('*')
    .eq('room', room);
  if (error) {
    console.error('fetchEvents error:', error);
    return [];
  }
  return (data ?? []) as ReactionEvent[];
}

export async function clearEvents(room: string) {
  if (!supabase) return;
  return supabase.from('reaction_events').delete().eq('room', room);
}

export async function countEvents(room: string): Promise<number> {
  if (!supabase) return 0;
  const { count, error } = await supabase
    .from('reaction_events')
    .select('*', { count: 'exact', head: true })
    .eq('room', room);
  if (error) {
    console.error('countEvents error:', error);
    return 0;
  }
  return count ?? 0;
}
