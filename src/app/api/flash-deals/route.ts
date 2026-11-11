import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/withAuth';
import { publicProductFilter } from '@/lib/catalog';

export const dynamic = 'force-dynamic';

export async function GET() {
  const now = new Date();
  const deals = await prisma.product.findMany({
    where: { ...publicProductFilter, dealStartsAt: { lte: now }, dealEndsAt: { gt: now }, dealRemaining: { gt: 0 }, stock: { gt: 0 }, dealPrice: { lt: prisma.product.fields.price } },
    select: { id: true, slug: true, title: true, price: true, dealPrice: true, dealEndsAt: true, dealRemaining: true, stock: true },
    orderBy: { dealEndsAt: 'asc' }, take: 50,
  });
  return NextResponse.json({ deals });
}

const schema = z.object({
  productId: z.string().min(1), priceKobo: z.number().int().min(1).max(999_999_999_999),
  stock: z.number().int().min(1).max(1000000), startsAt: z.string().datetime(), endsAt: z.string().datetime(),
});

export async function POST(req: Request) {
  const auth = await withAuth(req, ['SELLER']);
  if (!auth.ok) return auth.response;
  const result = schema.safeParse(await req.json().catch(() => null));
  if (!result.success) return NextResponse.json({ error: 'Valid deal details required' }, { status: 400 });
  const { productId, priceKobo, stock } = result.data;
  const startsAt = new Date(result.data.startsAt);
  const endsAt = new Date(result.data.endsAt);
  const now = new Date();
  if (startsAt < now || endsAt <= startsAt || endsAt.getTime() - startsAt.getTime() > 7 * 86400_000) {
    return NextResponse.json({ error: 'Choose a future deal window of up to seven days' }, { status: 400 });
  }
  const dealPrice = new Prisma.Decimal(priceKobo).div(100);
  const changed = await prisma.product.updateMany({
    where: {
      id: productId, published: true, price: { gt: dealPrice }, stock: { gte: stock },
      seller: { userId: auth.auth.sub, status: 'VERIFIED' },
      OR: [{ dealEndsAt: null }, { dealEndsAt: { lte: now } }],
    },
    data: { dealPrice, dealStartsAt: startsAt, dealEndsAt: endsAt, dealRemaining: stock },
  });
  return changed.count ? NextResponse.json({ success: true }, { status: 201 })
    : NextResponse.json({ error: 'Product unavailable, already scheduled or insufficient stock' }, { status: 409 });
}
