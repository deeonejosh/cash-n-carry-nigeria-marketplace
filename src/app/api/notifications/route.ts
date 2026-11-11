import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/withAuth';

export async function PATCH(req: Request) {
  const auth = await withAuth(req);
  if (!auth.ok) return auth.response;
  const data = await req.json().catch(() => null);
  if (typeof data?.id !== 'string') return NextResponse.json({ error: 'Notification required' }, { status: 400 });
  const result = await prisma.notification.updateMany({
    where: { id: data.id, userId: auth.auth.sub },
    data: { readAt: new Date() },
  });
  return result.count ? NextResponse.json({ success: true }) : NextResponse.json({ error: 'Notification not found' }, { status: 404 });
}
