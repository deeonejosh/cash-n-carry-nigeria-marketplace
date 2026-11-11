import { reconcilePayment } from '@/lib/reconcile-payment';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyWebhookSignature } from '@/lib/payments';

export async function POST(req: Request) {
  const rawBody = await req.text();
  try {
    if (!verifyWebhookSignature('flutterwave', rawBody, req.headers.get('verif-hash'))) return NextResponse.json({ success: false }, { status: 401 });
    const event = JSON.parse(rawBody);
    if (event.event !== 'charge.completed' || event.data?.status !== 'successful') return NextResponse.json({ received: true });
    const reference = event.data?.tx_ref;
    if (typeof reference !== 'string') return NextResponse.json({ received: true });
    const payment = await prisma.payment.findUnique({ where: { providerRef: reference } });
    if (!payment?.orderId) return NextResponse.json({ received: true });
    if (payment.status === 'REFUNDED' && payment.provider === 'FLUTTERWAVE') return NextResponse.json({ received: true });
    if (!(await reconcilePayment(payment, 'flutterwave'))) return NextResponse.json({ success: false, error: 'Payment does not match a payable order' }, { status: 409 });
    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json({ success: false }, { status: 400 });
  }
}
