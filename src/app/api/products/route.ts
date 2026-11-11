import { NextResponse } from 'next/server';
import { createProductSchema } from '@/lib/validators';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/withAuth';
import { Role } from '@prisma/client';

export async function GET() {
  const products = await prisma.product.findMany({
    where: { published: true, seller: { status: 'VERIFIED' } },
    include: { category: true, seller: { select: { id: true, storefrontName: true, location: true, rating: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ success: true, products });
}

export async function POST(req: Request) {
  const authResult = await withAuth(req, [Role.SELLER, Role.ADMIN]);
  if (!authResult.ok) return authResult.response;
  try {
    const payload = createProductSchema.parse(await req.json());
    const seller = await prisma.sellerProfile.findUnique({ where: { userId: authResult.auth.sub } });
    if (authResult.auth.role !== Role.ADMIN && (!seller || seller.status !== 'VERIFIED')) {
      return NextResponse.json({ success: false, error: 'A verified seller profile is required' }, { status: 403 });
    }
    const targetSellerId = seller?.id;
    if (!targetSellerId) return NextResponse.json({ success: false, error: 'Admin must select a seller through the moderation workflow' }, { status: 400 });
    const slug = payload.slug ?? payload.title.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const product = await prisma.product.create({ data: {
      sellerId: targetSellerId, title: payload.title, slug, description: payload.description,
      price: payload.price, compareAtPrice: payload.compareAtPrice, stock: payload.stock,
      imageUrl: payload.imageUrl ?? '', images: JSON.stringify(payload.images ?? []),
      categoryId: payload.categoryId, published: false,
    }, include: { category: true } });
    return NextResponse.json({ success: true, product }, { status: 201 });
  } catch (error) {
    const status = error instanceof Error && error.name === 'ZodError' ? 400 : 500;
    return NextResponse.json({ success: false, error: status === 400 ? 'Invalid product data' : 'Unable to create product' }, { status });
  }
}
