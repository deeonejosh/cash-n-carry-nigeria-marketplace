import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/withAuth';

const inputSchema = z.object({ ids: z.array(z.string().min(1).max(100)).min(1).max(100) });

export async function POST(req: Request) {
  const auth = await withAuth(req);
  if (!auth.ok) return auth.response;
  const input = inputSchema.safeParse(await req.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: 'Valid message IDs required' }, { status: 400 });
  const delivered = await prisma.message.updateMany({
    where: { id: { in: input.data.ids }, receiverId: auth.auth.sub, deliveredAt: null },
    data: { deliveredAt: new Date() },
  });
  return NextResponse.json({ delivered: delivered.count });
}
