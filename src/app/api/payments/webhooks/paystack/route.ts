import { reconcilePayment } from '@/lib/reconcile-payment';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyWebhookSignature, type Gateway } from '@/lib/payments';

async function handleWebhook(req: Request, provider: Gateway) {
  const rawBody = await req.text();
  const signature = provider === 'paystack' ? req.headers.get('x-paystack-signature') : req.headers.get('verif-hash');
  try {
    if (!verifyWebhookSignature(provider, rawBody, signature)) return NextResponse.json({ success: false }, { status: 401 });
    const event = JSON.parse(rawBody);
    const successful = provider === 'paystack' ? event.event === 'charge.success' : event.event === 'charge.completed';
    if (!successful) return NextResponse.json({ received: true });
    const reference = provider === 'paystack' ? event.data?.reference : event.data?.tx_ref;
    if (typeof reference !== 'string') return NextResponse.json({ received: true });
    const payment = await prisma.payment.findUnique({ where: { providerRef: reference }, include: { order: true } });
    if (!payment?.order) return NextResponse.json({ received: true });
    if (payment.status === 'REFUNDED' && payment.provider === 'PAYSTACK') return NextResponse.json({ received: true });
    if (!(await reconcilePayment(payment, provider))) return NextResponse.json({ success: false, error: 'Payment does not match a payable order' }, { status: 409 });
    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json({ success: false }, { status: 400 });
  }
}

export async function POST(req: Request) { return handleWebhook(req, 'paystack'); }
