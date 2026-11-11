import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/withAuth';

const submission = z.object({
  orderId: z.string().min(1), reason: z.enum(['DELIVERY', 'ITEM', 'OTHER']),
  description: z.string().trim().min(10).max(2000),
});
const decision = z.object({ id: z.string().min(1), resolution: z.string().trim().min(10).max(2000) });

export async function POST(req: Request) {
  const auth = await withAuth(req);
  if (!auth.ok) return auth.response;
  const input = submission.safeParse(await req.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: 'Order, reason and description required' }, { status: 400 });
  const { orderId, reason, description } = input.data;
  const userId = auth.auth.sub;
  const dispute = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId} AND "userId" = ${userId} FOR UPDATE`;
    const order = await tx.order.findFirst({
      where: { id: orderId, userId, status: { in: ['PAID', 'PACKING', 'SHIPPED', 'DELIVERED'] } }, select: { id: true },
    });
    if (!order) return null;
    const open = await tx.dispute.findFirst({ where: { orderId, openedById: userId, status: 'OPEN' } });
    if (open) return open;
    const created = await tx.dispute.create({ data: { orderId, openedById: userId, reason, description } });
    await tx.auditLog.create({
      data: { userId, type: 'DISPUTE_OPENED', message: `Opened order dispute ${created.id}` },
    });
    return created;
  });
  return dispute ? NextResponse.json({ dispute }, { status: 201 })
    : NextResponse.json({ error: 'Order unavailable for dispute' }, { status: 409 });
}

export async function PATCH(req: Request) {
  const auth = await withAuth(req, ['ADMIN']);
  if (!auth.ok) return auth.response;
  const input = decision.safeParse(await req.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: 'A resolution is required' }, { status: 400 });
  const { id, resolution } = input.data;
  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.dispute.updateMany({ where: { id, status: 'OPEN' }, data: { status: 'RESOLVED', resolution } });
    if (!updated.count) return false;
    const dispute = await tx.dispute.findUniqueOrThrow({ where: { id }, select: { openedById: true, orderId: true } });
    await tx.notification.create({
      data: { userId: dispute.openedById, title: 'Dispute resolved', body: `A resolution is available for order ${dispute.orderId}.`, type: 'dispute' },
    });
    await tx.auditLog.create({ data: { userId: auth.auth.sub, type: 'DISPUTE_RESOLVED', message: `Resolved order dispute ${id}` } });
    return true;
  });
  return result ? NextResponse.json({ success: true })
    : NextResponse.json({ error: 'Open dispute not found' }, { status: 409 });
}
