import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/withAuth';
import { Role } from '@prisma/client';
import { z } from 'zod';

const applicationSchema = z.object({
  businessName: z.string().trim().min(2).max(120),
  storefrontName: z.string().trim().min(2).max(120),
  location: z.string().trim().min(2).max(120),
  storeDescription: z.string().trim().max(1000).optional(),
});

export async function GET() {
  const sellers = await prisma.sellerProfile.findMany({
    where: { status: 'VERIFIED' },
    select: { id: true, storefrontName: true, businessName: true, storeDescription: true, location: true, rating: true, products: { where: { published: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ success: true, sellers });
}

export async function POST(req: Request) {
  const authResult = await withAuth(req, [Role.BUYER, Role.SELLER]);
  if (!authResult.ok) return authResult.response;

  const input = applicationSchema.partial().safeParse(await req.json().catch(() => null));
  if (!input.success) return NextResponse.json({ success: false, error: 'Invalid seller details' }, { status: 400 });
  const body = input.data;
  const existing = await prisma.sellerProfile.findUnique({ where: { userId: authResult.auth.sub } });
  if (existing) {
    const updated = await prisma.sellerProfile.update({
      where: { id: existing.id },
      data: {
        businessName: body.businessName ?? existing.businessName,
        storefrontName: body.storefrontName ?? existing.storefrontName,
        storeDescription: body.storeDescription ?? existing.storeDescription,
        location: body.location ?? existing.location,
      },
    });
    return NextResponse.json({ success: true, seller: updated });
  }

  const application = applicationSchema.safeParse(body);
  if (!application.success) return NextResponse.json({ success: false, error: 'Business name, storefront name and location are required' }, { status: 400 });
  const seller = await prisma.sellerProfile.upsert({
    where: { userId: authResult.auth.sub },
    update: {},
    create: {
      ...application.data,
      userId: authResult.auth.sub,
      kyc: { create: { userId: authResult.auth.sub, submittedAt: new Date() } },
    },
  });
  return NextResponse.json({ success: true, seller }, { status: 201 });
}
