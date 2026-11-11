import { reconcilePayment } from '@/lib/reconcile-payment';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUserFromRequest } from '@/lib/auth';
import type { Gateway } from '@/lib/payments';

export async function POST(req: Request) {
  const auth = await getAuthUserFromRequest(req);
  if (!auth) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const { reference } = await req.json();
    if (typeof reference !== 'string' || reference.length < 5) return NextResponse.json({ success: false, error: 'Invalid reference' }, { status: 400 });
    const payment = await prisma.payment.findFirst({ where: { providerRef: reference, userId: auth.sub }, include: { order: true } });
    if (!payment || !payment.order) return NextResponse.json({ success: false, error: 'Payment not found' }, { status: 404 });
    const provider: Gateway = payment.provider === 'PAYSTACK' ? 'paystack' : 'flutterwave';
    if (!(await reconcilePayment(payment, provider))) return NextResponse.json({ success: false, error: 'Payment does not match a payable order' }, { status: 409 });
    return NextResponse.json({ success: true, verified: true, orderId: payment.order.id });
  } catch {
    return NextResponse.json({ success: false, error: 'Payment verification unavailable' }, { status: 502 });
  }
}
