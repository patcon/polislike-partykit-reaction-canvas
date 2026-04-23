const STORAGE_KEY = 'polis_user_id';

// crypto.randomUUID() is only available in secure contexts (HTTPS + localhost).
// http://192.168.x.x and other LAN IPs are NOT secure contexts, so calling it
// directly throws — silently breaking any feature that generates IDs at runtime
// (e.g. snapping Moments over the local network). The fallback below matches the
// UUID v4 format and is safe everywhere.
export function generateUUID(): string {
  return crypto.randomUUID?.() ??
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}

export function getPersistentUserId(): string {
  const existing = localStorage.getItem(STORAGE_KEY);
  if (existing) return existing;
  const id = generateUUID();
  localStorage.setItem(STORAGE_KEY, id);
  return id;
}
