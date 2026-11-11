import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/withAuth';
import { prisma } from '@/lib/prisma';
import { publicProductFilter } from '@/lib/catalog';

export async function POST(req: Request) {
  const auth = await withAuth(req, ['BUYER']);
  if (!auth.ok) return auth.response;
  const payload = await req.json().catch(() => null);
  if (typeof payload?.productId !== 'string') return NextResponse.json({ error: 'Product required' }, { status: 400 });
  const product = await prisma.product.findFirst({ where: { ...publicProductFilter, id: payload.productId }, select: { id: true } });
  if (!product) return NextResponse.json({ error: 'Product unavailable' }, { status: 404 });
  await prisma.wishlistItem.createMany({ data: { userId: auth.auth.sub, productId: product.id }, skipDuplicates: true });
  return NextResponse.json({ success: true });
}

export async function DELETE(req: Request) {
  const auth = await withAuth(req, ['BUYER']);
  if (!auth.ok) return auth.response;
  const productId = new URL(req.url).searchParams.get('productId');
  if (!productId) return NextResponse.json({ error: 'Product required' }, { status: 400 });
  await prisma.wishlistItem.deleteMany({ where: { userId: auth.auth.sub, productId } });
  return NextResponse.json({ success: true });
}
