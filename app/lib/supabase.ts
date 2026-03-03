import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.PARTYKIT_SUPABASE_URL as string ?? '';
const SUPABASE_ANON_KEY = process.env.PARTYKIT_SUPABASE_ANON_KEY as string ?? '';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
  return supabase.from('reaction_events').insert(event);
}

export async function fetchEvents(room: string): Promise<ReactionEvent[]> {
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
  return supabase.from('reaction_events').delete().eq('room', room);
}

export async function countEvents(room: string): Promise<number> {
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
