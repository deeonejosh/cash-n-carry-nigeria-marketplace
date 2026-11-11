import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/withAuth';
import { Role } from '@prisma/client';

export async function GET(req: Request) {
  const authResult = await withAuth(req, [Role.ADMIN]);
  if (!authResult.ok) return authResult.response;

  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return NextResponse.json({ success: true, logs });
}
