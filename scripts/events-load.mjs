import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const origin = new URL(process.env.BROWSER_BASE_URL ?? 'https://localhost:3443');
const database = new URL(process.env.DATABASE_URL ?? '');
assert.ok(['localhost', '127.0.0.1'].includes(origin.hostname));
assert.ok(['localhost', '127.0.0.1'].includes(database.hostname) && /_test$/.test(database.pathname));

const prisma = new PrismaClient();
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 15000);
const sockets = 48;
const email = `load-${randomUUID()}@example.test`;
const url = (path) => new URL(path, origin);

async function until(reader, pattern) {
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) throw new Error(`Event stream ended before ${pattern}`);
    buffer += decoder.decode(value, { stream: true });
    if (buffer.includes(pattern)) return;
  }
}

try {
  const response = await fetch(url('/api/auth/register'), {
    method: 'POST', signal: controller.signal, headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Load Fixture', email, password: 'fixture-only-password' }),
  });
  assert.equal(response.status, 201);
  const cookie = response.headers.get('set-cookie').split(';')[0];
  const { user } = await response.json();
  const streams = await Promise.all(Array.from({ length: sockets }, async () => {
    const stream = await fetch(url('/api/events'), { headers: { cookie }, signal: controller.signal });
    assert.equal(stream.status, 200);
    const reader = stream.body.getReader();
    await until(reader, 'event: ready');
    return reader;
  }));
  const start = performance.now();
  await prisma.notification.create({ data: { userId: user.id, title: 'Load fixture', body: 'Shared listener fan-out' } });
  const latencies = await Promise.all(streams.map(async (reader) => {
    await until(reader, 'event: notification');
    return Math.round(performance.now() - start);
  }));
  latencies.sort((a, b) => a - b);
  console.log(`SSE fan-out: ${latencies.length}/${sockets} connections, p95 ${latencies[Math.ceil(sockets * 0.95) - 1]} ms, max ${latencies.at(-1)} ms`);
} finally {
  controller.abort();
  clearTimeout(timeout);
  await prisma.$disconnect();
}
