import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/withAuth';

const money = z.number().int().min(1).max(999_999_999_999);
const newAuction = z.object({ productId: z.string().min(1), startingBidKobo: money, durationMinutes: z.number().int().min(1).max(10080) });
const action = z.discriminatedUnion('action', [
  z.object({ action: z.literal('bid'), id: z.string().min(1), amountKobo: money }),
  z.object({ action: z.literal('close'), id: z.string().min(1) }),
  z.object({ action: z.literal('checkout'), id: z.string().min(1), shippingAddress: z.string().trim().min(8).max(1000) }),
]);

export async function GET(req: Request) {
  const auth = await withAuth(req);
  const viewerId = auth.ok ? auth.auth.sub : null;
  const listings = await prisma.auction.findMany({
    where: { productId: { not: null }, OR: [{ closedAt: null }, { winnerId: viewerId ?? '' }] },
    select: {
      id: true, title: true, startingBid: true, currentBid: true, endsAt: true, closedAt: true, releasedAt: true,
      winnerId: true, orderId: true, seller: { select: { storefrontName: true, userId: true } },
    },
    orderBy: { endsAt: 'desc' }, take: 50,
  });
  return NextResponse.json({
    auctions: listings.map(({ winnerId, orderId, seller, ...auction }) => ({
      ...auction, storefrontName: seller.storefrontName,
      own: viewerId !== null && seller.userId === viewerId,
      winning: viewerId !== null && winnerId === viewerId,
      orderId: viewerId !== null && winnerId === viewerId ? orderId : null,
    })),
  });
}

export async function POST(req: Request) {
  const auth = await withAuth(req, ['SELLER']);
  if (!auth.ok) return auth.response;
  const input = newAuction.safeParse(await req.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: 'Valid product, starting bid and duration required' }, { status: 400 });
  const { productId, startingBidKobo, durationMinutes } = input.data;
  const auction = await prisma.$transaction(async (tx) => {
    const reserved = await tx.product.updateMany({
      where: { id: productId, published: true, stock: { gt: 0 }, seller: { userId: auth.auth.sub, status: 'VERIFIED' } },
      data: { stock: { decrement: 1 } },
    });
    if (!reserved.count) return null;
    const product = await tx.product.findUniqueOrThrow({ where: { id: productId }, select: { sellerId: true, title: true } });
    return tx.auction.create({
      data: {
        ...product, productId, startingBid: new Prisma.Decimal(startingBidKobo).div(100),
        endsAt: new Date(Date.now() + durationMinutes * 60_000),
      },
    });
  });
  return auction ? NextResponse.json({ auction }, { status: 201 })
    : NextResponse.json({ error: 'Published product with available stock required' }, { status: 409 });
}

export async function PATCH(req: Request) {
  const auth = await withAuth(req);
  if (!auth.ok) return auth.response;
  const input = action.safeParse(await req.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: 'Invalid auction action' }, { status: 400 });
  const data = input.data;

  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Auction" WHERE "id" = ${data.id} FOR UPDATE`;
    const auction = await tx.auction.findUnique({
      where: { id: data.id }, include: { seller: { select: { userId: true, status: true } } },
    });
    if (!auction?.productId) return null;
    const now = new Date();

    if (data.action === 'bid') {
      if (auth.auth.role !== 'BUYER' || auction.seller.userId === auth.auth.sub ||
          auction.closedAt || now >= auction.endsAt || auction.seller.status !== 'VERIFIED') return null;
      const amount = new Prisma.Decimal(data.amountKobo).div(100);
      if (auction.currentBid ? amount.lte(auction.currentBid) : amount.lt(auction.startingBid)) return null;
      await tx.bid.create({ data: { auctionId: auction.id, bidderId: auth.auth.sub, amount } });
      await tx.auction.update({ where: { id: auction.id }, data: { currentBid: amount, winnerId: auth.auth.sub } });
      return { success: true };
    }

    if (now < auction.endsAt) return null;
    if (data.action === 'close') {
      if (auction.seller.userId !== auth.auth.sub && auth.auth.role !== 'ADMIN') return null;
      if (!auction.closedAt) {
        await tx.auction.update({ where: { id: auction.id }, data: { closedAt: now } });
        if (!auction.winnerId) {
          await tx.product.update({ where: { id: auction.productId }, data: { stock: { increment: 1 } } });
        }
      }
      return { success: true };
    }

    if (auth.auth.role !== 'BUYER' || auction.winnerId !== auth.auth.sub || !auction.currentBid) return null;
    if (auction.orderId) return { success: true, orderId: auction.orderId };
    if (auction.releasedAt || now.getTime() > auction.endsAt.getTime() + 30 * 60_000) return null;
    if (auction.seller.status !== 'VERIFIED') return null;
    const order = await tx.order.create({
      data: {
        userId: auth.auth.sub, shippingAddress: data.shippingAddress, total: auction.currentBid,
        reservationEnds: new Date(now.getTime() + 30 * 60_000),
        items: { create: { productId: auction.productId, quantity: 1, price: auction.currentBid } },
      },
    });
    await tx.auction.update({ where: { id: auction.id }, data: { closedAt: auction.closedAt ?? now, orderId: order.id } });
    return { success: true, orderId: order.id };
  });
  return result ? NextResponse.json(result) : NextResponse.json({ error: 'Auction action unavailable' }, { status: 409 });
}
