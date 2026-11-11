import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/withAuth';
import { testGatewaySecret } from '@/lib/payments';
import { refreshGatewayRefund, submitGatewayRefund } from '@/lib/gateway-refunds';

const inputSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('create'), paymentId: z.string().min(1), requestId: z.string().uuid(),
    returnId: z.string().min(1).optional(), amountKobo: z.number().int().min(1).max(999_999_999_999), reason: z.string().trim().min(5).max(500) }),
  z.object({ action: z.literal('refresh'), refundId: z.string().min(1) }),
]);

export async function POST(req: Request) {
  const auth = await withAuth(req, ['ADMIN']);
  if (!auth.ok) return auth.response;
  const parsed = inputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Valid refund details required' }, { status: 400 });
  const input = parsed.data;
  const existing = input.action === 'refresh'
    ? await prisma.refund.findUnique({ where: { id: input.refundId } })
    : await prisma.refund.findUnique({ where: { requestKey: input.requestId } });
  const paymentId = input.action === 'create' ? input.paymentId : existing?.paymentId;
  const payment = paymentId ? await prisma.payment.findUnique({ where: { id: paymentId } }) : null;
  if (!payment?.providerRef || !payment.orderId || !['PAYSTACK', 'FLUTTERWAVE'].includes(payment.provider) || payment.currency !== 'NGN') {
    return NextResponse.json({ error: 'Gateway payment unavailable' }, { status: 404 });
  }
  const provider = payment.provider === 'PAYSTACK' ? 'paystack' : 'flutterwave';
  if (input.action === 'create' && existing) {
    if (existing.paymentId !== payment.id || !existing.amount.times(100).equals(input.amountKobo) || existing.reason !== input.reason || existing.returnId !== (input.returnId ?? null)) {
      return NextResponse.json({ error: 'Refund request ID already used' }, { status: 409 });
    }
    return NextResponse.json({ refund: existing });
  }
  if (input.action === 'refresh' && !existing?.providerRef) {
    return NextResponse.json({ error: 'Provider reference unavailable. Check the provider dashboard before retrying.' }, { status: 409 });
  }
  try { testGatewaySecret(provider); } catch {
    return NextResponse.json({ error: 'Test refund provider is not configured' }, { status: 503 });
  }

  const claim = input.action === 'create' ? await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Payment" WHERE "id" = ${payment.id} FOR UPDATE`;
    const repeat = await tx.refund.findUnique({ where: { requestKey: input.requestId } });
    if (repeat) {
      return repeat.paymentId === payment.id && repeat.amount.times(100).equals(input.amountKobo) && repeat.reason === input.reason && repeat.returnId === (input.returnId ?? null)
        ? { refund: repeat, submit: false } : null;
    }
    const fresh = await tx.payment.findUniqueOrThrow({ where: { id: payment.id } });
    if (fresh.status !== 'SUCCESS') return null;
    const amount = new Prisma.Decimal(input.amountKobo).div(100);
    if (input.returnId) {
      const itemReturn = await tx.returnRequest.findFirst({
        where: { id: input.returnId, status: 'RECEIVED', orderItem: { orderId: payment.orderId! }, refunds: { none: { status: { not: 'FAILED' } } } },
        select: { quantity: true, orderItem: { select: { price: true } } },
      });
      if (!itemReturn || !itemReturn.orderItem.price.times(itemReturn.quantity).equals(amount)) return null;
    }
    const allocated = await tx.refund.aggregate({ where: { paymentId: payment.id, status: { not: 'FAILED' } }, _sum: { amount: true } });
    if ((allocated._sum.amount ?? new Prisma.Decimal(0)).plus(amount).gt(fresh.amount)) return null;
    const refund = await tx.refund.create({
      data: { paymentId: payment.id, amount, reason: input.reason, requestKey: input.requestId, returnId: input.returnId, status: 'SUBMITTING' },
    });
    await tx.payoutDraft.updateMany({
      where: { settlement: { paymentId: payment.id }, status: 'DRAFT' }, data: { status: 'STALE' },
    });
    return { refund, submit: true };
  }) : existing ? { refund: existing, submit: false } : null;
  if (!claim) return NextResponse.json({ error: 'Refund exceeds the available payment balance or request is unavailable' }, { status: 409 });
  const { refund } = claim;
  if ((input.action === 'create' && !claim.submit) || ['SUCCESS', 'FAILED'].includes(refund.status)) return NextResponse.json({ refund });

  try {
    const result = input.action === 'create'
      ? await submitGatewayRefund(provider, payment.providerRef, input.amountKobo, input.requestId)
      : await refreshGatewayRefund(provider, refund.providerRef!, refund.amount.times(100).toNumber());
    const updated = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Payment" WHERE "id" = ${payment.id} FOR UPDATE`;
      const current = await tx.refund.findUniqueOrThrow({ where: { id: refund.id } });
      if (['SUCCESS', 'FAILED'].includes(current.status)) return current;
      const record = await tx.refund.update({
        where: { id: refund.id }, data: { providerRef: result.reference, status: result.status },
      });
      if (result.status === 'SUCCESS') {
        if (record.returnId) await tx.returnRequest.update({ where: { id: record.returnId }, data: { status: 'REFUNDED' } });
        const successful = await tx.refund.aggregate({ where: { paymentId: payment.id, status: 'SUCCESS' }, _sum: { amount: true } });
        if (successful._sum.amount?.equals(payment.amount)) {
          await tx.payment.update({ where: { id: payment.id }, data: { status: 'REFUNDED' } });
          await tx.order.update({ where: { id: payment.orderId! }, data: { status: 'REFUNDED' } });
        }
        await tx.auditLog.create({
          data: { userId: auth.auth.sub, type: 'ORDER_REFUNDED', message: `Sandbox refund ${refund.id} confirmed` },
        });
        await tx.notification.create({
          data: { userId: payment.userId, title: 'Refund confirmed', body: `A refund for order ${payment.orderId} was confirmed.`, type: 'order' },
        });
      }
      return record;
    });
    return NextResponse.json({ refund: updated });
  } catch {
    if (claim.submit) await prisma.refund.updateMany({ where: { id: refund.id, status: 'SUBMITTING' }, data: { status: 'UNKNOWN' } });
    return NextResponse.json({ error: 'Refund could not be confirmed. Review the recorded attempt before retrying.' }, { status: 502 });
  }
}
