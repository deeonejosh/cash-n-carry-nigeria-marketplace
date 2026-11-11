import { testGatewaySecret, verifyGatewayPayment, type Gateway } from '@/lib/payments';

type RefundResult = { reference: string; status: 'PROCESSING' | 'SUCCESS' | 'FAILED' };

async function gatewayRequest(provider: Gateway, url: string, body?: object) {
  const response = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${testGatewaySecret(provider)}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(12000), cache: 'no-store',
  });
  const payload = await response.json();
  if (!response.ok || (provider === 'paystack' ? payload.status !== true : payload.status !== 'success') || !payload.data) {
    throw new Error('Refund gateway response unavailable');
  }
  return payload.data;
}

function parseRefund(provider: Gateway, data: Record<string, unknown>, amountKobo: number): RefundResult {
  const reference = String(data.id ?? '');
  const amount = provider === 'paystack' ? Number(data.amount) : Math.round(Number(data.amount_refunded) * 100);
  if (!/^\d+$/.test(reference) || amount !== amountKobo || (data.currency && data.currency !== 'NGN')) {
    throw new Error('Refund amount or reference did not match');
  }
  const status = String(data.status);
  const settled = provider === 'paystack' ? status === 'processed' :
    ['completed-bank-transfer', 'completed-momo', 'completed-mpgs', 'completed-offline', 'completed-preauth'].includes(status);
  return { reference, status: settled ? 'SUCCESS' : status === 'failed' ? 'FAILED' : 'PROCESSING' };
}

export async function submitGatewayRefund(provider: Gateway, transactionRef: string, amountKobo: number, requestId: string) {
  if (provider === 'paystack') {
    const data = await gatewayRequest(provider, 'https://api.paystack.co/refund', {
      transaction: transactionRef, amount: amountKobo, currency: 'NGN', reference: `cnc-${requestId}`,
    });
    return parseRefund(provider, data, amountKobo);
  }
  const payment = await verifyGatewayPayment(provider, transactionRef);
  const transactionId = 'transactionId' in payment ? payment.transactionId : undefined;
  if (!payment.success || payment.reference !== transactionRef || payment.currency !== 'NGN' ||
      !transactionId || !/^\d+$/.test(transactionId) || Math.round(payment.amount * 100) < amountKobo) {
    throw new Error('Original transaction could not be confirmed');
  }
  const data = await gatewayRequest(provider, `https://api.flutterwave.com/v3/transactions/${transactionId}/refund`, {
    amount: amountKobo / 100, comments: `Cash N Carry refund ${requestId}`,
  });
  return parseRefund(provider, data, amountKobo);
}

export async function refreshGatewayRefund(provider: Gateway, reference: string, amountKobo: number) {
  const url = provider === 'paystack' ? 'https://api.paystack.co/refund/' : 'https://api.flutterwave.com/v3/refunds/';
  const data = await gatewayRequest(provider, url + encodeURIComponent(reference));
  const result = parseRefund(provider, data, amountKobo);
  if (result.reference !== reference) throw new Error('Refund reference did not match');
  return result;
}
