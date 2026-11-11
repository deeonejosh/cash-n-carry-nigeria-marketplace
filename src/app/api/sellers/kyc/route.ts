import { readProtectedDocument, storeProtectedDocument } from '@/lib/kyc-object-storage';
import { openDocument, scanDocument, sealDocument } from '@/lib/kyc-document';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/withAuth';

const maxBytes = 5 * 1024 * 1024;

export async function POST(req: Request) {
  const auth = await withAuth(req, ['BUYER', 'SELLER']);
  if (!auth.ok) return auth.response;
  const length = Number(req.headers.get('content-length'));
  if (length > maxBytes + 16384) return NextResponse.json({ error: 'File is too large' }, { status: 413 });
  if (!req.headers.get('content-type')?.startsWith('application/pdf')) {
    return NextResponse.json({ error: 'Submit a PDF document' }, { status: 415 });
  }
  const reader = req.body?.getReader();
  if (!reader) return NextResponse.json({ error: 'Document required' }, { status: 400 });

  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > maxBytes) {
        await reader.cancel();
        return NextResponse.json({ error: 'File is too large' }, { status: 413 });
      }
      chunks.push(value);
    }
  } catch {
    return NextResponse.json({ error: 'Unable to read file' }, { status: 400 });
  }
  const file = Buffer.concat(chunks, size);
  if (file.subarray(0, 5).toString() !== '%PDF-') return NextResponse.json({ error: 'Invalid PDF header' }, { status: 415 });

  const eligible = { userId: auth.auth.sub, status: { in: ['PENDING', 'REJECTED'] as ('PENDING' | 'REJECTED')[] }, seller: { status: 'PENDING' as const } };
  if (!(await prisma.sellerKyc.findFirst({ where: eligible, select: { id: true } }))) {
    return NextResponse.json({ error: 'No application accepting documents' }, { status: 409 });
  }
  let protectedFile: Buffer;
  let documentObjectKey: string | null;
  try {
    if (await scanDocument(file) !== 'clean') return NextResponse.json({ error: 'Document rejected by security scan' }, { status: 422 });
    protectedFile = sealDocument(file, auth.auth.sub);
    documentObjectKey = await storeProtectedDocument(protectedFile);
  } catch {
    return NextResponse.json({ error: 'Document security service unavailable' }, { status: 503 });
  }

  const changed = await prisma.sellerKyc.updateMany({
    where: eligible,
    data: { documentData: documentObjectKey ? null : protectedFile, documentObjectKey, documentType: 'application/pdf', status: 'PENDING', submittedAt: new Date() },
  });
  return changed.count
    ? NextResponse.json({ success: true })
    : NextResponse.json({ error: 'No application accepting documents' }, { status: 409 });
}

export async function GET(req: Request) {
  const auth = await withAuth(req, ['ADMIN']);
  if (!auth.ok) return auth.response;
  const params = new URL(req.url).searchParams;
  const sellerId = params.get('sellerId');
  const submission = params.get('submission');
  if (!sellerId) return NextResponse.json({ error: 'Seller required' }, { status: 400 });
  const kyc = await prisma.sellerKyc.findUnique({ where: { sellerId }, select: { documentData: true, documentObjectKey: true, submittedAt: true, userId: true } });
  if (submission && kyc?.submittedAt?.toISOString() !== submission) return NextResponse.json({ error: 'Document changed. Refresh the review queue.' }, { status: 409 });
  if (!kyc?.documentData && !kyc?.documentObjectKey) return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  let document: Buffer;
  try {
    document = openDocument(kyc.documentObjectKey ? await readProtectedDocument(kyc.documentObjectKey) : kyc.documentData!, kyc.userId);
  } catch {
    return NextResponse.json({ error: 'Protected document unavailable' }, { status: 503 });
  }
  await prisma.auditLog.create({
    data: { userId: auth.auth.sub, type: 'KYC_DOCUMENT_ACCESSED', message: `Downloaded KYC document for seller ${sellerId}` },
  });
  return new Response(new Uint8Array(document), {
    headers: {
      'content-type': 'application/octet-stream',
      'content-disposition': 'attachment; filename="seller-kyc.pdf"',
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}
