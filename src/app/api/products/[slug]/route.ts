import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/withAuth';
import { Role } from '@prisma/client';
import { z } from 'zod';

const patch = z.object({
  title: z.string().trim().min(3).max(150).optional(),
  description: z.string().trim().min(12).max(5000).optional(),
  price: z.number().positive().max(9999999999.99).optional(),
  stock: z.number().int().min(0).max(1000000).optional(),
  expectedStock: z.number().int().min(0).max(1000000).optional(),
  published: z.boolean().optional(),
}).refine((value) => value.stock === undefined || value.expectedStock !== undefined);

export async function PATCH(req: Request, { params: routeParams }: { params: Promise<{ slug: string }> }) {
  const params = await routeParams;
  const auth = await withAuth(req, [Role.SELLER, Role.ADMIN]);
  if (!auth.ok) return auth.response;
  const input = patch.safeParse(await req.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: 'Invalid product update' }, { status: 400 });
  const { expectedStock, published, ...fields } = input.data;
  if (published === true && auth.auth.role !== 'ADMIN') {
    return NextResponse.json({ error: 'An administrator must publish listings' }, { status: 403 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const changed = await tx.product.updateMany({
      where: {
        slug: params.slug, stock: expectedStock,
        ...(auth.auth.role === 'ADMIN'
          ? (published ? { seller: { status: 'VERIFIED' } } : {})
          : { seller: { userId: auth.auth.sub, status: 'VERIFIED' } }),
      },
      data: { ...fields, published },
    });
    if (!changed.count) return null;
    const product = await tx.product.findUniqueOrThrow({ where: { slug: params.slug } });
    await tx.auditLog.create({
      data: {
        userId: auth.auth.sub, type: 'PRODUCT_UPDATED', message: `Updated product ${product.id}`,
        metadata: JSON.stringify({ fields: Object.keys(input.data).filter((key) => key !== 'expectedStock') }),
      },
    });
    return product;
  });
  return result ? NextResponse.json({ success: true, product: result })
    : NextResponse.json({ error: 'Product unavailable or inventory changed. Reload and try again.' }, { status: 409 });
}
