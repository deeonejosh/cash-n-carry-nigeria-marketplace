import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, db: 'connected', mode: process.env.NODE_ENV });
  } catch (error) {
    return NextResponse.json({ ok: false, db: 'unavailable', mode: process.env.NODE_ENV }, { status: 503 });
  }
}
