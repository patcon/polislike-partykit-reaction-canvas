export interface PolisStatement {
  txt: string;
  tid: number;
  created?: string;
  quote_src_url?: string | null;
  is_seed?: boolean;
  is_meta?: boolean;
  lang?: string;
  pid?: number;
  velocity?: number;
  mod?: number;
  active?: boolean;
  agree_count?: number;
  disagree_count?: number;
  pass_count?: number;
  count?: number;
  conversation_id?: string;
}

export interface QueueItem {
  statementId: number;
  displayTimestamp: number;
}

export interface Statement {
  statementId: number;
  timecode: number;
  text: string;
}