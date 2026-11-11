import crypto from 'node:crypto';

export type Gateway = 'flutterwave' | 'paystack';

export function testGatewaySecret(provider: Gateway) {
  const value = provider === 'flutterwave' ? process.env.FLUTTERWAVE_SECRET_KEY : process.env.PAYSTACK_SECRET_KEY;
  const testPrefix = provider === 'flutterwave' ? 'FLWSECK_TEST-' : 'sk_test_';
  if (!value?.startsWith(testPrefix)) throw new Error(`${provider.toUpperCase()}_SECRET_KEY must be a test key`);
  return value;
}

export async function initializeGatewayPayment(input: { provider: Gateway; reference: string; amount: number; email: string; orderId: string; name: string }) {
  const { provider, reference, amount, email, orderId, name } = input;
  const apiSecret = testGatewaySecret(provider);
  if (provider === 'paystack') {
    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST', signal: AbortSignal.timeout(12_000), headers: { Authorization: `Bearer ${apiSecret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, amount: Math.round(amount * 100), currency: 'NGN', reference, callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/complete`, metadata: { orderId } }),
    });
    const json = await response.json();
    if (!response.ok || !json.status) throw new Error('Paystack initialization failed');
    return { checkoutUrl: json.data.authorization_url as string, accessCode: json.data.access_code as string };
  }
  const response = await fetch('https://api.flutterwave.com/v3/payments', {
    method: 'POST', signal: AbortSignal.timeout(12_000), headers: { Authorization: `Bearer ${apiSecret}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ tx_ref: reference, amount, currency: 'NGN', redirect_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/complete`, customer: { email, name }, meta: { orderId }, customizations: { title: 'Cash N Carry', description: `Order ${orderId}` } }),
  });
  const json = await response.json();
  if (!response.ok || json.status !== 'success') throw new Error('Flutterwave initialization failed');
  return { checkoutUrl: json.data.link as string };
}

export async function verifyGatewayPayment(provider: Gateway, reference: string) {
  const apiSecret = testGatewaySecret(provider);
  const url = provider === 'paystack'
    ? `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`
    : `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${apiSecret}` }, cache: 'no-store', signal: AbortSignal.timeout(12_000) });
  const json = await response.json();
  if (!response.ok || (provider === 'paystack' ? !json.status : json.status !== 'success')) throw new Error('Gateway verification unavailable');
  const data = json.data;
  return provider === 'paystack'
    ? { success: data.status === 'success', reference: data.reference as string, amount: Number(data.amount) / 100, currency: data.currency as string, metadata: data.metadata }
    : { success: data.status === 'successful', reference: data.tx_ref as string, amount: Number(data.amount), currency: data.currency as string, transactionId: String(data.id), metadata: data.meta };
}

export function verifyWebhookSignature(provider: Gateway, rawBody: string, signature: string | null) {
  if (!signature) return false;
  if (provider === 'flutterwave') {
    const webhookSecret = process.env.FLUTTERWAVE_WEBHOOK_SECRET;
    if (!webhookSecret) return false;
    const received = Buffer.from(signature);
    const expected = Buffer.from(webhookSecret);
    return received.length === expected.length && crypto.timingSafeEqual(received, expected);
  }
  const expected = crypto.createHmac('sha512', testGatewaySecret(provider)).update(rawBody).digest('hex');
  const received = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  return received.length === expectedBuffer.length && crypto.timingSafeEqual(received, expectedBuffer);
}
