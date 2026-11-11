import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

const schema = z.object({
  shipmentId: z.string().min(1).max(100), trackingRef: z.string().min(1).max(120),
  carrier: z.string().min(1).max(100), eventId: z.string().min(1).max(120),
  status: z.enum(['ACCEPTED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'EXCEPTION', 'RETURNED']),
  occurredAt: z.string().datetime(),
});

export async function POST(req: Request) {
  const key = process.env.CARRIER_WEBHOOK_SECRET;
  if (!key || key.length < 32) return NextResponse.json({ error: 'Carrier adapter unavailable' }, { status: 503 });
  const timestamp = req.headers.get('x-cnc-timestamp') ?? '';
  const signature = req.headers.get('x-cnc-signature') ?? '';
  if (!/^\d{10}$/.test(timestamp) || Math.abs(Date.now() - Number(timestamp) * 1000) > 300_000 || !/^[a-f\d]{64}$/i.test(signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }
  const reader = req.body?.getReader();
  if (!reader) return NextResponse.json({ error: 'Tracking event required' }, { status: 400 });
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.length;
      if (bytes > 8192) {
        await reader.cancel();
        return NextResponse.json({ error: 'Tracking event too large' }, { status: 413 });
      }
      chunks.push(value);
    }
  } catch {
    return NextResponse.json({ error: 'Tracking event unavailable' }, { status: 400 });
  }
  const body = Buffer.concat(chunks, bytes);
  const expected = createHmac('sha256', key).update(timestamp + '.').update(body).digest();
  if (!timingSafeEqual(expected, Buffer.from(signature, 'hex'))) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }
  let decoded: unknown;
  try { decoded = JSON.parse(body.toString('utf8')); } catch { decoded = null; }
  const parsed = schema.safeParse(decoded);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid tracking event' }, { status: 400 });
  const { shipmentId, carrier, trackingRef, occurredAt, eventId, status } = parsed.data;
  const result = await prisma.$transaction(async (tx) => {
    const shipment = await tx.orderShipment.findFirst({
      where: { id: shipmentId, carrier, trackingRef, status: { in: ['SHIPPED', 'DELIVERED'] } },
      select: { orderId: true, order: { select: { userId: true } } },
    });
    if (!shipment) return null;
    const saved = await tx.shipmentTrackingEvent.createMany({
      data: { shipmentId, eventId, status, occurredAt: new Date(occurredAt) }, skipDuplicates: true,
    });
    if (saved.count) await tx.notification.create({
      data: { userId: shipment.order.userId, title: 'Carrier tracking update', body: `Order ${shipment.orderId}: ${status.replaceAll('_', ' ').toLowerCase()}.`, type: 'order' },
    });
    return saved.count > 0;
  });
  return result === null ? NextResponse.json({ error: 'Shipment tracking details do not match' }, { status: 404 })
    : NextResponse.json({ received: true, newEvent: result });
}
