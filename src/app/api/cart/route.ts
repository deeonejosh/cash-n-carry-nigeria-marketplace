import { activeDeal } from '@/lib/flash-deals';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/withAuth';
import { Role } from '@prisma/client';

export async function GET(req: Request) {
  const auth = await withAuth(req, [Role.BUYER]);
  if (!auth.ok) return auth.response;
  const cart = await prisma.cart.findUnique({ where: { userId: auth.auth.sub }, include: { items: { include: { product: true } } } });
  const items = cart?.items.map((item) => ({
    ...item, product: { ...item.product, price: activeDeal(item.product)?.price ?? item.product.price },
  })) ?? [];
  return NextResponse.json({ success: true, cart: { ...cart, items } });
}

export async function POST(req: Request) {
  const auth = await withAuth(req, [Role.BUYER]);
  if (!auth.ok) return auth.response;
  try {
    const { productId, quantity } = await req.json();
    if (typeof productId !== 'string' || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) return NextResponse.json({ success: false, error: 'Invalid cart item' }, { status: 400 });
    const product = await prisma.product.findFirst({ where: { id: productId, published: true, seller: { status: 'VERIFIED' } } });
    if (!product) return NextResponse.json({ success: false, error: 'Product unavailable' }, { status: 404 });
    const cart = await prisma.cart.upsert({ where: { userId: auth.auth.sub }, create: { userId: auth.auth.sub }, update: {} });
    const item = await prisma.cartItem.upsert({ where: { cartId_productId: { cartId: cart.id, productId } }, create: { cartId: cart.id, productId, quantity }, update: { quantity } });
    return NextResponse.json({ success: true, item }, { status: 201 });
  } catch {
    return NextResponse.json({ success: false, error: 'Unable to update cart' }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  const auth = await withAuth(req, [Role.BUYER]);
  if (!auth.ok) return auth.response;
  const { searchParams } = new URL(req.url);
  const productId = searchParams.get('productId');
  if (!productId) return NextResponse.json({ success: false, error: 'productId is required' }, { status: 400 });
  const cart = await prisma.cart.findUnique({ where: { userId: auth.auth.sub } });
  if (cart) await prisma.cartItem.deleteMany({ where: { cartId: cart.id, productId } });
  return NextResponse.json({ success: true });
}
