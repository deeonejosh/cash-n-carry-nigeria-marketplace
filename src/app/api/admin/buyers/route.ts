import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/withAuth';
import { prisma } from '@/lib/prisma';

const schema = z.object({ id: z.string().min(1), active: z.boolean() });

export async function PATCH(req: Request) {
  const auth = await withAuth(req, ['ADMIN']);
  if (!auth.ok) return auth.response;
  const input = schema.safeParse(await req.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: 'Buyer and account status required' }, { status: 400 });
  const { id, active } = input.data;
  const changed = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.updateMany({ where: { id, role: 'BUYER', isActive: !active }, data: { isActive: active } });
    if (!updated.count) return false;
    if (!active) await tx.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    await tx.auditLog.create({
      data: { userId: auth.auth.sub, type: 'USER_STATUS_CHANGED', message: `Buyer ${id} ${active ? 'reactivated' : 'suspended'}` },
    });
    return true;
  });
  return changed ? NextResponse.json({ success: true })
    : NextResponse.json({ error: 'Buyer unavailable or status unchanged' }, { status: 409 });
}
