import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/withAuth';

const steps = ['PENDING', 'PACKING', 'SHIPPED', 'DELIVERED'] as const;
const inputSchema = z.object({
  id: z.string().min(1), status: z.enum(['PACKING', 'SHIPPED', 'DELIVERED']),
  carrier: z.string().trim().min(1).max(100).optional(),
  trackingRef: z.string().trim().min(1).max(120).optional(),
});

export async function PATCH(req: Request) {
  const auth = await withAuth(req, ['SELLER', 'ADMIN']);
  if (!auth.ok) return auth.response;
  const input = inputSchema.safeParse(await req.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: 'Invalid shipment update' }, { status: 400 });
  const { id, status, carrier, trackingRef } = input.data;
  if (status === 'SHIPPED' && (!carrier || !trackingRef)) {
    return NextResponse.json({ error: 'Carrier and tracking reference required' }, { status: 400 });
  }
  if (status === 'DELIVERED' && auth.auth.role !== 'ADMIN') return NextResponse.json({ error: 'Administrator required' }, { status: 403 });

  const changed = await prisma.$transaction(async (tx) => {
    const shipment = await tx.orderShipment.findFirst({
      where: { id, ...(auth.auth.role === 'SELLER' ? { seller: { userId: auth.auth.sub, status: 'VERIFIED' } } : {}) },
      select: { orderId: true },
    });
    if (!shipment) return false;
    await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${shipment.orderId} FOR UPDATE`;
    const order = await tx.order.findUniqueOrThrow({ where: { id: shipment.orderId }, select: { status: true, userId: true } });
    if (!['PAID', 'PACKING', 'SHIPPED'].includes(order.status)) return false;

    const updated = await tx.orderShipment.updateMany({
      where: { id, status: steps[steps.indexOf(status) - 1] },
      data: { status, ...(status === 'SHIPPED' ? { carrier, trackingRef } : {}) },
    });
    if (!updated.count) return false;
    const shipments = await tx.orderShipment.findMany({ where: { orderId: shipment.orderId }, select: { status: true } });
    const minimum = Math.min(...shipments.map((item) => steps.indexOf(item.status as typeof steps[number])));
    if (minimum >= 1) await tx.order.update({ where: { id: shipment.orderId }, data: { status: steps[minimum] } });
    await tx.notification.create({
      data: { userId: order.userId, title: 'Shipment updated', body: `A shipment for order ${shipment.orderId} is now ${status.toLowerCase()}.`, type: 'order' },
    });
    await tx.auditLog.create({
      data: { userId: auth.auth.sub, type: 'ORDER_STATUS_CHANGED', message: `Shipment ${id} moved to ${status}` },
    });
    return true;
  });
  return changed ? NextResponse.json({ success: true }) : NextResponse.json({ error: 'Shipment unavailable or status changed' }, { status: 409 });
}
