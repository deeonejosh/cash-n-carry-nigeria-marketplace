import { Prisma, type Payment } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { verifyGatewayPayment, type Gateway } from '@/lib/payments';

export async function reconcilePayment(payment: Payment, provider: Gateway) {
  const expectedProvider = provider === 'paystack' ? 'PAYSTACK' : 'FLUTTERWAVE';
  if (payment.provider !== expectedProvider || !payment.providerRef || !payment.orderId) return false;
  if (payment.status === 'SUCCESS') return true;
  if (payment.status !== 'PENDING') return false;

  const verified = await verifyGatewayPayment(provider, payment.providerRef);
  if (!verified.success || verified.reference !== payment.providerRef ||
      verified.currency !== payment.currency || !Number.isFinite(verified.amount) ||
      !payment.amount.equals(verified.amount)) return false;

  return prisma.$transaction(async (tx) => {
    const order = await tx.order.updateMany({
      where: { id: payment.orderId!, userId: payment.userId, status: 'PENDING', total: payment.amount },
      data: { status: 'PAID' },
    });
    if (order.count === 0) {
      const current = await tx.payment.findUnique({ where: { id: payment.id } });
      return current?.status === 'SUCCESS';
    }
    const updated = await tx.payment.updateMany({
      where: { id: payment.id, status: 'PENDING' },
      data: { status: 'SUCCESS' },
    });
    if (updated.count !== 1) throw new Error('Payment changed during reconciliation');
    const items = await tx.orderItem.findMany({
      where: { orderId: payment.orderId! },
      select: { quantity: true, price: true, product: { select: { sellerId: true } } },
    });
    const allocations = new Map<string, Prisma.Decimal>();
    for (const item of items) {
      const sellerId = item.product.sellerId;
      allocations.set(sellerId, (allocations.get(sellerId) ?? new Prisma.Decimal(0)).plus(item.price.times(item.quantity)));
    }
    if (allocations.size) await tx.sellerSettlement.createMany({
      data: Array.from(allocations, ([sellerId, gross]) => ({ sellerId, gross, currency: payment.currency, paymentId: payment.id })),
    });
    return true;
  });
}
