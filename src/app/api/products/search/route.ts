import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') ?? '';

  const products = await prisma.product.findMany({
    where: {
      published: true,
      seller: { status: 'VERIFIED' },
      ...(q ? {
      OR: [
        { title: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ],
    } : {}),
    },
    include: { category: true, seller: { select: { id: true, storefrontName: true, location: true, rating: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ success: true, products });
}
