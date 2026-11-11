import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/withAuth';
import { prisma } from '@/lib/prisma';

const addressSchema = z.object({ label: z.string().trim().min(1).max(60), address: z.string().trim().min(8).max(1000) });

export async function GET(req: Request) {
  const auth = await withAuth(req, ['BUYER']);
  if (!auth.ok) return auth.response;
  const addresses = await prisma.address.findMany({ where: { userId: auth.auth.sub }, orderBy: { createdAt: 'desc' }, take: 50 });
  return NextResponse.json({ addresses });
}

export async function POST(req: Request) {
  const auth = await withAuth(req, ['BUYER']);
  if (!auth.ok) return auth.response;
  const input = addressSchema.safeParse(await req.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: 'Valid address and label required' }, { status: 400 });
  const address = await prisma.address.create({ data: { userId: auth.auth.sub, ...input.data } });
  return NextResponse.json({ address }, { status: 201 });
}

export async function DELETE(req: Request) {
  const auth = await withAuth(req, ['BUYER']);
  if (!auth.ok) return auth.response;
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Address required' }, { status: 400 });
  await prisma.address.deleteMany({ where: { id, userId: auth.auth.sub } });
  return NextResponse.json({ success: true });
}
