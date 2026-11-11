import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/withAuth';
import { Role } from '@prisma/client';

export async function GET(req: Request) {
  const authResult = await withAuth(req, [Role.BUYER, Role.SELLER, Role.ADMIN]);
  if (!authResult.ok) return authResult.response;

  const user = await prisma.user.findUnique({
    where: { id: authResult.auth.sub },
    select: { id: true, email: true, name: true, role: true, avatarUrl: true, sellerProfile: true, cart: { include: { items: true } } },
  });

  return NextResponse.json({ success: true, user });
}
