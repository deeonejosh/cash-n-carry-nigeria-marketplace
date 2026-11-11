import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/withAuth';

const requestSchema = z.object({
  itemId: z.string().min(1), requestId: z.string().uuid(), quantity: z.number().int().min(1).max(9900),
  reason: z.string().trim().min(5).max(500),
});
const reviewSchema = z.object({ id: z.string().min(1), status: z.enum(['APPROVED', 'REJECTED', 'RECEIVED']) });

export async function POST(req: Request) {
  const auth = await withAuth(req);
  if (!auth.ok) return auth.response;
  const input = requestSchema.safeParse(await req.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: 'Valid return details required' }, { status: 400 });
  const { itemId, requestId, quantity, reason } = input.data;
  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "OrderItem" WHERE "id" = ${itemId} FOR UPDATE`;
    const item = await tx.orderItem.findFirst({
      where: { id: itemId, order: { userId: auth.auth.sub } },
      select: { id: true, quantity: true, order: { select: { status: true } }, shipment: { select: { status: true } } },
    });
    if (!item) return null;
    const existing = await tx.returnRequest.findUnique({ where: { requestId } });
    if (existing) return existing.orderItemId === item.id && existing.quantity === quantity && existing.reason === reason ? existing : null;
    if (['CANCELLED', 'REFUNDED', 'PENDING'].includes(item.order.status) ||
        !['SHIPPED', 'DELIVERED'].includes(item.shipment?.status ?? item.order.status)) return null;
    const used = await tx.returnRequest.aggregate({
      where: { orderItemId: itemId, status: { not: 'REJECTED' } }, _sum: { quantity: true },
    });
    if ((used._sum.quantity ?? 0) + quantity > item.quantity) return null;
    return tx.returnRequest.create({ data: { orderItemId: itemId, requestId, quantity, reason } });
  });
  return result ? NextResponse.json({ returnRequest: result }, { status: 201 })
    : NextResponse.json({ error: 'Item is unavailable for this return quantity' }, { status: 409 });
}

export async function PATCH(req: Request) {
  const auth = await withAuth(req, ['ADMIN']);
  if (!auth.ok) return auth.response;
  const input = reviewSchema.safeParse(await req.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: 'Valid return status required' }, { status: 400 });
  const { id, status } = input.data;
  const changed = await prisma.$transaction(async (tx) => {
    const result = await tx.returnRequest.updateMany({
      where: { id, status: status === 'RECEIVED' ? 'APPROVED' : 'REQUESTED' }, data: { status },
    });
    if (!result.count) return false;
    const item = await tx.returnRequest.findUniqueOrThrow({
      where: { id }, select: { orderItem: { select: { order: { select: { userId: true } } } } },
    });
    await tx.notification.create({
      data: { userId: item.orderItem.order.userId, title: 'Return status updated', body: `Return ${id} is now ${status.toLowerCase()}.`, type: 'order' },
    });
    return true;
  });
  return changed ? NextResponse.json({ success: true }) : NextResponse.json({ error: 'Return state changed' }, { status: 409 });
}
