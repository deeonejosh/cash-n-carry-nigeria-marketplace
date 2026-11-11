import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUserFromRequest } from '@/lib/auth';

export async function GET(req: Request) {
  const auth = await getAuthUserFromRequest(req);
  if (!auth) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const products = await prisma.product.findMany({
    where: auth.role === 'ADMIN' ? {} : auth.role === 'SELLER'
      ? { seller: { userId: auth.sub } }
      : { published: true, seller: { status: 'VERIFIED' } },
    include: { seller: true, category: true },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ success: true, products });
}
