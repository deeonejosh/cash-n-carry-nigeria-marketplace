import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUserFromRequest } from '@/lib/auth';
import { initializeGatewayPayment, testGatewaySecret } from '@/lib/payments';
import { z } from 'zod';

const inputSchema = z.object({ provider: z.enum(['paystack', 'flutterwave']), orderId: z.string().min(1) });

export async function POST(req: Request) {
  const auth = await getAuthUserFromRequest(req);
  if (!auth) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  const input = inputSchema.safeParse(await req.json().catch(() => null));
  if (!input.success) return NextResponse.json({ success: false, error: 'Valid provider and orderId are required' }, { status: 400 });
  const { orderId, provider } = input.data;
  const providerName = provider === 'paystack' ? 'PAYSTACK' : 'FLUTTERWAVE';

  try {
    const attempt = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId} AND "userId" = ${auth.sub} FOR UPDATE`;
      const order = await tx.order.findFirst({
        where: { id: orderId, userId: auth.sub, status: 'PENDING' },
        include: { user: { select: { email: true, name: true } } },
      });
      if (!order) return null;
      const existing = await tx.payment.findFirst({ where: { orderId, status: 'PENDING' }, orderBy: { createdAt: 'desc' } });
      if (existing) return { order, payment: existing, created: false };
      testGatewaySecret(provider);
      if (order.reservationEnds && order.reservationEnds <= new Date()) return null;
      const payment = await tx.payment.create({
        data: { userId: auth.sub, orderId, provider: providerName, providerRef: `cnc-${randomUUID()}`, amount: order.total },
      });
      return { order, payment, created: true };
    });
    if (!attempt) return NextResponse.json({ success: false, error: 'Order unavailable or reservation expired' }, { status: 409 });
    const { order, payment, created } = attempt;
    if (!created && (payment.provider !== providerName || !payment.checkoutUrl)) {
      return NextResponse.json({ success: false, error: 'A payment attempt already exists. Check its status before retrying.' }, { status: 409 });
    }
    let checkoutUrl = payment.checkoutUrl;
    if (created) {
      try {
        const gateway = await initializeGatewayPayment({
          provider, reference: payment.providerRef!, amount: Number(order.total),
          email: order.user.email, name: order.user.name, orderId,
        });
        checkoutUrl = gateway.checkoutUrl;
        if (new URL(checkoutUrl).protocol !== 'https:') throw new Error('Invalid checkout URL');
        await prisma.payment.update({ where: { id: payment.id }, data: { checkoutUrl } });
      } catch {
        // The provider may have accepted a timed-out request. Preserve its reference.
        return NextResponse.json({ success: false, error: 'Payment initialization could not be confirmed. Check the order before retrying.' }, { status: 502 });
      }
    }
    return NextResponse.json({ success: true, paymentId: payment.id, reference: payment.providerRef, checkoutUrl, testMode: true });
  } catch (error) {
    if (error instanceof Error && error.message.endsWith('must be a test key')) {
      return NextResponse.json({ success: false, error: 'This test payment provider is not configured' }, { status: 503 });
    }
    return NextResponse.json({ success: false, error: 'Unable to initialize payment' }, { status: 500 });
  }
}
