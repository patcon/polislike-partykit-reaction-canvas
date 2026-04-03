const STORAGE_KEY = 'polis_user_id';

export function getPersistentUserId(): string {
  const existing = localStorage.getItem(STORAGE_KEY);
  if (existing) return existing;
  const id = crypto.randomUUID?.() ??
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  localStorage.setItem(STORAGE_KEY, id);
  return id;
}
