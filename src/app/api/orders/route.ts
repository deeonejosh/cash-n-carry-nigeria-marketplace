import { activeDeal } from '@/lib/flash-deals';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/withAuth';
import { Prisma, Role } from '@prisma/client';
import { expireReservations } from '@/lib/reservations';
import { createOrderSchema } from '@/lib/validators';

export async function POST(req: Request) {
  const auth = await withAuth(req, [Role.BUYER]);
  if (!auth.ok) return auth.response;
  try {
    const input = createOrderSchema.parse(await req.json());
    const quantities = new Map<string, number>();
    for (const item of input.items) quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
    const ids = Array.from(quantities.keys());
    await expireReservations();

    const order = await prisma.$transaction(async (tx) => {
      if (input.checkoutKey) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${auth.auth.sub + ':' + input.checkoutKey}, 0))`;
        const existing = await tx.order.findUnique({
          where: { userId_checkoutKey: { userId: auth.auth.sub, checkoutKey: input.checkoutKey } },
          include: { items: { include: { product: true } } },
        });
        if (existing) {
          if (existing.shippingAddress !== input.shippingAddress || existing.items.length !== ids.length ||
              existing.items.some((item) => quantities.get(item.productId) !== item.quantity)) {
            throw new Error('CHECKOUT_KEY_CONFLICT');
          }
          return existing;
        }
      }
      const products = await tx.product.findMany({ where: { id: { in: ids }, published: true, seller: { status: 'VERIFIED' } }, orderBy: { id: 'asc' } });
      if (products.length !== ids.length) throw new Error('PRODUCT_NOT_AVAILABLE');
      const lines: { productId: string; quantity: number; price: Prisma.Decimal; dealStartsAt?: Date }[] = [];
      for (const product of products) {
        await tx.$queryRaw`SELECT "id" FROM "Product" WHERE "id" = ${product.id} FOR UPDATE`;
        const current = await tx.product.findFirst({
          where: { id: product.id, published: true, seller: { status: 'VERIFIED' } },
        });
        if (!current) throw new Error('PRODUCT_NOT_AVAILABLE');
        const quantity = quantities.get(product.id)!;
        const deal = activeDeal(current);
        if (deal && deal.remaining < quantity) throw new Error('DEAL_STOCK');
        if (current.stock < quantity) throw new Error('INSUFFICIENT_STOCK');
        await tx.product.update({
          where: { id: product.id },
          data: { stock: { decrement: quantity }, ...(deal ? { dealRemaining: { decrement: quantity } } : {}) },
        });
        lines.push({ productId: product.id, quantity, price: deal?.price ?? current.price, dealStartsAt: deal?.startsAt });
      }
      const total = lines.reduce((sum, line) => sum.plus(line.price.times(line.quantity)), new Prisma.Decimal(0));
      const created = await tx.order.create({
        data: { userId: auth.auth.sub, total, checkoutKey: input.checkoutKey, reservationEnds: new Date(Date.now() + 30 * 60_000), shippingAddress: input.shippingAddress, status: 'PENDING', items: { create: lines } },
        include: { items: { include: { product: true } } },
      });
      const sellers = Array.from(new Set(created.items.map((item) => item.product.sellerId)));
      if (sellers.length > 1) {
        for (const sellerId of sellers) {
          const shipment = await tx.orderShipment.create({ data: { orderId: created.id, sellerId } });
          await tx.orderItem.updateMany({
            where: { id: { in: created.items.filter((item) => item.product.sellerId === sellerId).map((item) => item.id) } },
            data: { shipmentId: shipment.id },
          });
        }
      }
      return created;
    });
    return NextResponse.json({ success: true, order }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'CHECKOUT_KEY_CONFLICT') return NextResponse.json({ success: false, error: 'Checkout details changed. Start a new checkout.' }, { status: 409 });
    if (error instanceof Error && error.message === 'PRODUCT_NOT_AVAILABLE') return NextResponse.json({ success: false, error: 'One or more products are unavailable' }, { status: 409 });
    if (error instanceof Error && error.message === 'DEAL_STOCK') return NextResponse.json({ success: false, error: 'Reduce quantity to the remaining flash deal stock.' }, { status: 409 });
    if (error instanceof Error && error.message === 'INSUFFICIENT_STOCK') return NextResponse.json({ success: false, error: 'Insufficient inventory for one or more items' }, { status: 409 });
    const status = error instanceof Error && error.name === 'ZodError' ? 400 : 500;
    return NextResponse.json({ success: false, error: status === 400 ? 'Invalid order request' : 'Unable to create order' }, { status });
  }
}

export async function GET(req: Request) {
  const auth = await withAuth(req, [Role.BUYER, Role.SELLER, Role.ADMIN]);
  if (!auth.ok) return auth.response;
  if (auth.auth.role === Role.SELLER) {
    const sellerItem = { product: { seller: { userId: auth.auth.sub } } };
    const orders = await prisma.order.findMany({
      where: { items: { some: sellerItem } },
      select: {
        id: true, status: true, createdAt: true,
        items: { where: sellerItem, include: { product: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ success: true, orders });
  }
  const where = auth.auth.role === Role.ADMIN ? {} : { userId: auth.auth.sub };
  const orders = await prisma.order.findMany({ where, include: { items: { include: { product: true } }, payments: true }, orderBy: { createdAt: 'desc' } });
  return NextResponse.json({ success: true, orders });
}
