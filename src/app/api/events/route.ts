import { withAuth } from '@/lib/withAuth';
import { subscribeToEvents } from '@/lib/event-broker';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const auth = await withAuth(req);
  if (!auth.ok) return auth.response;
  const connectionString = process.env.EVENTS_DATABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) return new Response(null, { status: 503 });
  const encoder = new TextEncoder();
  let stop = () => {};
  let emit = (_data: string) => {};
  const unsubscribe = await subscribeToEvents(connectionString, auth.auth.sub, {
    close: () => stop(),
    send: (kind) => emit(`event: ${kind}\ndata: {}\n\n`),
  });
  if (!unsubscribe) return new Response(null, { status: 503 });

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      emit = (data) => {
        if (closed) return;
        if ((controller.desiredSize ?? 1) < -10) { stop(); return; }
        controller.enqueue(encoder.encode(data));
      };
      const heartbeat = setInterval(() => emit(': heartbeat\n\n'), 15000);
      const timeout = setTimeout(() => stop(), 55000);
      stop = () => {
        if (closed) return;
        closed = true;
        clearTimeout(timeout);
        clearInterval(heartbeat);
        req.signal.removeEventListener('abort', stop);
        unsubscribe();
        try { controller.close(); } catch { /* consumer disconnected */ }
      };
      req.signal.addEventListener('abort', stop, { once: true });
      if (req.signal.aborted) { stop(); return; }
      emit('retry: 5000\nevent: ready\ndata: {}\n\n');
    },
    cancel() { stop(); },
  });
  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'private, no-cache, no-transform', 'X-Accel-Buffering': 'no' },
  });
}
