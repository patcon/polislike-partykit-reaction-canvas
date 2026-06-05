export const VOTE_COLORS = {
  positive: '#2ecc71',
  negative: '#e74c3c',
  neutral:  '#f1c40f',
} as const;

export const USER_STATUS_COLORS = {
  idle:    '#888',   // connected WebSocket, no active cursor
  offline: '#333',   // WebSocket disconnected, was in graph
} as const;

export const USER_STATUS_LABELS = {
  idle:    'idle',
  offline: 'offline',
} as const;

export const MISSING_COLOR = '#b0b0b0';

export const EDGE_COLOR       = '#555';
export const EDGE_FLASH_COLOR = '#4ade80';
export const EDGE_FLASH_MS    = 800;
