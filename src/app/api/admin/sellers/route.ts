import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/withAuth';
import { Role } from '@prisma/client';
import { z } from 'zod';

const reviewSchema = z.object({
  sellerId: z.string().min(1),
  status: z.enum(['APPROVED', 'PENDING', 'REJECTED', 'SUSPENDED']),
  reviewedSubmission: z.string().datetime().optional(),
  note: z.string().trim().max(1000).optional(),
});

export async function PATCH(req: Request) {
  const auth = await withAuth(req, [Role.ADMIN]);
  if (!auth.ok) return auth.response;
  const review = reviewSchema.safeParse(await req.json().catch(() => null));
  if (!review.success) return NextResponse.json({ success: false, error: 'Invalid seller review' }, { status: 400 });
  const { sellerId, status, note, reviewedSubmission } = review.data;
  const target = await prisma.sellerProfile.findUnique({ where: { id: sellerId }, select: { userId: true } });
  if (!target) return NextResponse.json({ success: false, error: 'Seller not found' }, { status: 404 });

  const seller = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "SellerProfile" WHERE "id" = ${sellerId} FOR UPDATE`;
    if (status === 'APPROVED') {
      await tx.$queryRaw`SELECT "id" FROM "SellerKyc" WHERE "sellerId" = ${sellerId} FOR UPDATE`;
      const document = reviewedSubmission ? await tx.sellerKyc.findFirst({
        where: { sellerId, status: 'PENDING', submittedAt: new Date(reviewedSubmission), OR: [{ documentData: { not: null } }, { documentObjectKey: { not: null } }] },
        select: { id: true },
      }) : null;
      if (!document) return null;
    }
    const profile = await tx.sellerProfile.update({
      where: { id: sellerId },
      data: {
        status: status === 'APPROVED' ? 'VERIFIED' : status === 'SUSPENDED' ? 'SUSPENDED' : 'PENDING',
        verificationNote: note ?? null,
      },
    });
    const kycStatus = status === 'SUSPENDED' ? 'REJECTED' : status;
    const approvedAt = status === 'APPROVED' ? new Date() : null;
    await tx.sellerKyc.upsert({
      where: { userId: profile.userId },
      create: { userId: profile.userId, sellerId, status: kycStatus, approvedAt },
      update: { sellerId, status: kycStatus, approvedAt },
    });
    if (status === 'APPROVED') {
      await tx.user.updateMany({ where: { id: profile.userId, role: 'BUYER' }, data: { role: 'SELLER' } });
    }
    await tx.auditLog.create({
      data: { userId: auth.auth.sub, type: 'SELLER_VERIFIED', message: `Seller review ${status}: ${profile.storefrontName}` },
    });
    return profile;
  });
  return seller ? NextResponse.json({ success: true, seller })
    : NextResponse.json({ error: 'Download and review the current submitted PDF before approval' }, { status: 409 });
}
