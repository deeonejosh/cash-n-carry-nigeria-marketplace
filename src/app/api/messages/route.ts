import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/withAuth';
import { Role } from '@prisma/client';
import { createMessageSchema } from '@/lib/validators';

const sender = { select: { id: true, name: true, avatarUrl: true } } as const;

function participantFilter(userId: string) {
  return { OR: [{ participants: { startsWith: `${userId}:` } }, { participants: { endsWith: `:${userId}` } }] };
}

export async function GET(req: Request) {
  const auth = await withAuth(req, [Role.BUYER, Role.SELLER, Role.ADMIN]);
  if (!auth.ok) return auth.response;

  const threads = await prisma.messageThread.findMany({
    where: participantFilter(auth.auth.sub),
    include: { messages: { include: { sender }, orderBy: { createdAt: 'desc' }, take: 50 } },
    orderBy: { lastMessageAt: 'desc' },
    take: 50,
  });
  return NextResponse.json({ success: true, viewerId: auth.auth.sub, threads });
}

export async function POST(req: Request) {
  const auth = await withAuth(req, [Role.BUYER, Role.SELLER, Role.ADMIN]);
  if (!auth.ok) return auth.response;

  try {
    const payload = createMessageSchema.parse(await req.json());
    const userId = auth.auth.sub;
    const thread = payload.threadId
      ? await prisma.messageThread.findFirst({ where: { id: payload.threadId, ...participantFilter(userId) } })
      : null;
    if (payload.threadId && !thread) {
      return NextResponse.json({ success: false, error: 'Thread not found' }, { status: 404 });
    }
    const receiverId = thread
      ? thread.participants.split(':').find((id) => id !== userId)
      : payload.receiverId;
    const receiver = receiverId && !receiverId.includes(':') && receiverId !== userId
      ? await prisma.user.findFirst({ where: { id: receiverId, isActive: true }, select: { id: true } })
      : null;
    if (!receiver) return NextResponse.json({ success: false, error: 'Recipient unavailable' }, { status: 400 });

    const message = await prisma.$transaction(async (tx) => {
      const lastMessageAt = new Date();
      const target = thread
        ? await tx.messageThread.update({ where: { id: thread.id }, data: { lastMessageAt } })
        : await tx.messageThread.create({ data: { title: 'Direct message', participants: `${userId}:${receiver.id}`, lastMessageAt } });
      return tx.message.create({
        data: { threadId: target.id, senderId: userId, receiverId: receiver.id, text: payload.text },
        include: { sender },
      });
    });
    return NextResponse.json({ success: true, message }, { status: 201 });
  } catch {
    return NextResponse.json({ success: false, error: 'Unable to send message' }, { status: 400 });
  }
}
