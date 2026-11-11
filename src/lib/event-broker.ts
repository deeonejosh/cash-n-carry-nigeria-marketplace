import { Client } from 'pg';

type EventKind = 'message' | 'notification' | 'receipt';
type Subscriber = { send: (kind: EventKind) => void; close: () => void };

const subscribers = new Map<string, Set<Subscriber>>();
let connection: Promise<Client> | undefined;
let count = 0;
const maximum = 256;

function connect(url: string) {
  if (connection) return connection;
  const client = new Client({ connectionString: url, connectionTimeoutMillis: 1500 });
  let pending: Promise<Client>;
  const invalidate = () => {
    if (connection !== pending) return;
    connection = undefined;
    subscribers.forEach((group) => group.forEach((subscriber) => subscriber.close()));
    void client.end().catch(() => {});
  };
  client.on('error', invalidate);
  client.on('end', invalidate);
  client.on('notification', ({ payload }) => {
    if (!payload) return;
    try {
      const event = JSON.parse(payload);
      if (typeof event.userId !== 'string' || !['message', 'notification', 'receipt'].includes(event.kind)) return;
      subscribers.get(event.userId)?.forEach((subscriber) => subscriber.send(event.kind));
    } catch { /* ignore invalid notification payloads */ }
  });
  pending = (async () => {
    await client.connect();
    await client.query('LISTEN cnc_marketplace');
    return client;
  })();
  connection = pending;
  void pending.catch(invalidate);
  return pending;
}

export async function subscribeToEvents(url: string, userId: string, subscriber: Subscriber) {
  if (count >= maximum) return null;
  count += 1;
  try {
    await connect(url);
  } catch {
    count -= 1;
    return null;
  }
  const group = subscribers.get(userId) ?? new Set<Subscriber>();
  group.add(subscriber);
  subscribers.set(userId, group);
  return () => {
    if (!group.delete(subscriber)) return;
    count -= 1;
    if (!group.size) subscribers.delete(userId);
  };
}
