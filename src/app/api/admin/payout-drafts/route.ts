import { commissionRate, netPayout } from '@/lib/payout-accounting';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/withAuth';

export async function POST(req: Request) {
  const auth = await withAuth(req, ['ADMIN']);
  if (!auth.ok) return auth.response;
  const input = await req.json().catch(() => null);
  if (typeof input?.settlementId !== 'string') return NextResponse.json({ error: 'Settlement required' }, { status: 400 });
  let commissionBps: number;
  try { commissionBps = commissionRate(); }
  catch { return NextResponse.json({ error: 'Seller commission configuration invalid' }, { status: 503 }); }
  const result = await prisma.$transaction(async (tx) => {
    const settlement = await tx.sellerSettlement.findUnique({ where: { id: input.settlementId } });
    if (!settlement) return null;
    await tx.$queryRaw`SELECT "id" FROM "Payment" WHERE "id" = ${settlement.paymentId} FOR UPDATE`;
    const payment = await tx.payment.findUnique({
      where: { id: settlement.paymentId },
      select: {
        status: true, order: { select: { status: true } },
        refunds: { where: { status: { not: 'FAILED' } }, select: {
          amount: true, status: true, returnRequest: { select: { orderItem: { select: { product: { select: { sellerId: true } } } } } },
        } },
      },
    });
    if (payment?.status !== 'SUCCESS' || payment.order?.status !== 'DELIVERED') return null;
    if (payment.refunds.some((refund) => refund.status !== 'SUCCESS' || !refund.returnRequest)) return null;
    const adjustedGross = payment.refunds.reduce((balance, refund) =>
      refund.returnRequest?.orderItem.product.sellerId === settlement.sellerId ? balance.minus(refund.amount) : balance,
    settlement.gross);
    if (!adjustedGross.gt(0)) return null;
    const { amount, commissionAmount } = netPayout(adjustedGross, commissionBps);
    if (!amount.gt(0)) return null;
    return tx.payoutDraft.upsert({
      where: { settlementId: settlement.id },
      create: { settlementId: settlement.id, amount, commissionBps, commissionAmount, currency: settlement.currency, preparedBy: auth.auth.sub },
      update: { amount, commissionBps, commissionAmount, status: 'DRAFT', preparedBy: auth.auth.sub },
    });
  });
  return result ? NextResponse.json({ payoutDraft: result })
    : NextResponse.json({ error: 'Delivery, payment or refund reconciliation must be completed first' }, { status: 409 });
}
