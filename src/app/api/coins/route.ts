import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/withAuth';

const gifts = { rose: 10, star: 100, lion: 1000 } as const;
const action = z.discriminatedUnion('action', [
  z.object({ action: z.literal('credit'), requestId: z.string().uuid(), recipientId: z.string().min(1), coins: z.number().int().min(1).max(10000) }),
  z.object({ action: z.literal('gift'), requestId: z.string().uuid(), recipientId: z.string().min(1), gift: z.enum(['rose', 'star', 'lion']) }),
]);

export async function GET(req: Request) {
  const auth = await withAuth(req);
  if (!auth.ok) return auth.response;
  const userId = auth.auth.sub;
  const [balance, activity] = await prisma.$transaction([
    prisma.coinLedger.aggregate({ where: { userId }, _sum: { delta: true } }),
    prisma.coinLedger.findMany({
      where: { userId }, orderBy: { createdAt: 'desc' }, take: 50,
      select: { id: true, delta: true, reason: true, createdAt: true },
    }),
  ]);
  return NextResponse.json({ balance: balance._sum.delta ?? 0, activity });
}

export async function POST(req: Request) {
  const auth = await withAuth(req);
  if (!auth.ok) return auth.response;
  const input = action.safeParse(await req.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: 'Invalid coin operation' }, { status: 400 });
  const data = input.data;
  const actor = auth.auth.sub;
  if (data.action === 'credit' && auth.auth.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Administrator required' }, { status: 403 });
  }
  if (data.action === 'gift' && data.recipientId === actor) {
    return NextResponse.json({ error: 'Select another recipient' }, { status: 400 });
  }
  const key = `${data.action}:${actor}:${data.requestId}`;

  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'coins:' + actor}, 0))`;
    const recipient = await tx.user.findFirst({ where: { id: data.recipientId, isActive: true }, select: { id: true } });
    if (!recipient) return null;

    if (data.action === 'credit') {
      const existing = await tx.coinLedger.findUnique({ where: { idempotencyKey: key } });
      if (existing) return existing.userId === recipient.id && existing.delta === data.coins ? { success: true } : null;
      await tx.coinLedger.create({ data: { userId: recipient.id, delta: data.coins, reason: 'Promotional credit', idempotencyKey: key } });
      await tx.auditLog.create({ data: { userId: actor, type: 'COINS_CREDITED', message: `Credited ${data.coins} promotional coins to ${recipient.id}` } });
      return { success: true };
    }

    const amount = gifts[data.gift];
    const existing = await tx.gift.findUnique({ where: { requestKey: key } });
    if (existing) {
      return existing.receiverId === recipient.id && existing.type === data.gift ? { success: true, giftId: existing.id } : null;
    }
    const balance = await tx.coinLedger.aggregate({ where: { userId: actor }, _sum: { delta: true } });
    if ((balance._sum.delta ?? 0) < amount) return null;
    const gift = await tx.gift.create({
      data: { senderId: actor, receiverId: recipient.id, type: data.gift, amount, requestKey: key },
    });
    await tx.coinLedger.createMany({
      data: [
        { userId: actor, delta: -amount, reason: 'Gift sent', idempotencyKey: `${key}:debit` },
        { userId: recipient.id, delta: amount, reason: 'Gift received', idempotencyKey: `${key}:credit` },
      ],
    });
    await tx.auditLog.create({ data: { userId: actor, type: 'GIFT_SENT', message: `Gift ${gift.id} transferred ${amount} coins` } });
    return { success: true, giftId: gift.id };
  });

  return result ? NextResponse.json(result)
    : NextResponse.json({ error: 'Coin operation unavailable. Check the recipient, balance or request details.' }, { status: 409 });
}
