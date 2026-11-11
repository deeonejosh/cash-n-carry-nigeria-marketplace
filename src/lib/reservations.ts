import { prisma } from '@/lib/prisma';

export async function expireReservations(now = new Date()) {
  return prisma.$transaction(async (tx) => {
    const orders = await tx.$queryRaw<{ id: string }[]>`
      SELECT "Order"."id" FROM "Order"
      WHERE "status" = 'PENDING' AND "reservationEnds" <= ${now}
        AND NOT EXISTS (SELECT 1 FROM "Payment" WHERE "Payment"."orderId" = "Order"."id")
      ORDER BY "reservationEnds", "id" LIMIT 50 FOR UPDATE SKIP LOCKED
    `;
    let expired = 0;
    for (const { id } of orders) {
      // A gateway may still settle an attempted payment. Leave it for reconciliation.
      const payment = await tx.payment.findFirst({ where: { orderId: id }, select: { id: true } });
      if (payment) continue;
      await tx.order.update({ where: { id }, data: { status: 'CANCELLED' } });
      const items = await tx.orderItem.findMany({ where: { orderId: id }, orderBy: { productId: 'asc' } });
      for (const item of items) {
        await tx.product.update({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } });
        if (item.dealStartsAt) {
          await tx.product.updateMany({
            where: { id: item.productId, dealStartsAt: item.dealStartsAt },
            data: { dealRemaining: { increment: item.quantity } },
          });
        }
      }
      expired += 1;
    }
    return expired;
  });
}


export async function expireAuctionReservations(now = new Date()) {
  return prisma.$transaction(async (tx) => {
    const auctions = await tx.$queryRaw<{ id: string; productId: string }[]>`
      SELECT "id", "productId" FROM "Auction"
      WHERE "productId" IS NOT NULL AND "orderId" IS NULL AND "releasedAt" IS NULL
        AND (("winnerId" IS NULL AND "closedAt" IS NULL AND "endsAt" <= ${now})
          OR ("winnerId" IS NOT NULL AND "endsAt" <= ${new Date(now.getTime() - 30 * 60_000)}))
      ORDER BY "endsAt", "id" LIMIT 50 FOR UPDATE SKIP LOCKED
    `;
    for (const auction of auctions) {
      await tx.auction.update({ where: { id: auction.id }, data: { closedAt: now, releasedAt: now } });
      await tx.product.update({ where: { id: auction.productId }, data: { stock: { increment: 1 } } });
    }
    return auctions.length;
  });
}
