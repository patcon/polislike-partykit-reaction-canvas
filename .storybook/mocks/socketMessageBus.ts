type MessageCallback = (evt: MessageEvent) => void;

const bus = new Map<string, Set<MessageCallback>>();

export function subscribe(room: string, cb: MessageCallback) {
  let set = bus.get(room);
  if (!set) { set = new Set(); bus.set(room, set); }
  set.add(cb);
}

export function unsubscribe(room: string, cb: MessageCallback) {
  bus.get(room)?.delete(cb);
}

export function emitToRoom(room: string, data: object) {
  const payload = JSON.stringify(data);
  bus.get(room)?.forEach(cb => cb(new MessageEvent('message', { data: payload })));
}
