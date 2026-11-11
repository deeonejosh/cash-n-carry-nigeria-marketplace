import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/withAuth';
import { prisma } from '@/lib/prisma';

const transitions = { PACKING: 'PAID', SHIPPED: 'PACKING', DELIVERED: 'SHIPPED' } as const;
const schema = z.object({ orderId: z.string().min(1), status: z.enum(['PACKING', 'SHIPPED', 'DELIVERED']) });

export async function PATCH(req: Request) {
  const auth = await withAuth(req, ['ADMIN', 'SELLER']);
  if (!auth.ok) return auth.response;
  const input = schema.safeParse(await req.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: 'Order and valid status required' }, { status: 400 });
  const { orderId, status } = input.data;
  const sellerOnly = auth.auth.role === 'SELLER';
  if (sellerOnly && status === 'DELIVERED') return NextResponse.json({ error: 'Administrator required' }, { status: 403 });
  const sellerItem = { product: { seller: { userId: auth.auth.sub, status: 'VERIFIED' as const } } };
  const changed = await prisma.$transaction(async (tx) => {
    const result = await tx.order.updateMany({ where: {
      id: orderId, status: transitions[status], shipments: { none: {} },
      ...(sellerOnly ? { items: { some: sellerItem, every: sellerItem } } : {}),
    }, data: { status } });
    if (!result.count) return false;
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, select: { userId: true } });
    await tx.notification.create({
      data: { userId: order.userId, title: 'Order status updated', body: `Order ${orderId} is now ${status.toLowerCase()}.`, type: 'order' },
    });
    await tx.auditLog.create({
      data: { userId: auth.auth.sub, type: 'ORDER_STATUS_CHANGED', message: `Order ${orderId} moved to ${status}` },
    });
    return true;
  });
  return changed
    ? NextResponse.json({ success: true })
    : NextResponse.json({ error: 'Order does not support this status change' }, { status: 409 });
}
