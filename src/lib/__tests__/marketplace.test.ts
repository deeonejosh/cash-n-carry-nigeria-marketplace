import { refreshGatewayRefund, submitGatewayRefund } from '@/lib/gateway-refunds';
import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hashPassword, verifyPassword } from '@/lib/auth';
import { verifyGatewayPayment, verifyWebhookSignature } from '@/lib/payments';

beforeEach(() => {
  vi.stubEnv('FLUTTERWAVE_SECRET_KEY', 'FLWSECK_TEST-fixture');
  vi.stubEnv('PAYSTACK_SECRET_KEY', 'sk_test_fixture');
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('auth helpers', () => {
  it('hashes passwords and verifies valid and invalid credentials', async () => {
    const hash = await hashPassword('valid-test-password');
    expect(hash).not.toBe('valid-test-password');
    expect(await verifyPassword('valid-test-password', hash)).toBe(true);
    expect(await verifyPassword('wrong-password', hash)).toBe(false);
  });
});

describe('payment verification with local fixtures', () => {
  it('verifies a successful Flutterwave response without network access', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({
      status: 'success', data: { status: 'successful', tx_ref: 'FLW_TEST_REF_123', amount: 1200, currency: 'NGN', id: 42, meta: { orderId: 'order-1' } },
    }) });
    vi.stubGlobal('fetch', fetchMock);
    const result = await verifyGatewayPayment('flutterwave', 'FLW_TEST_REF_123');
    expect(result.success).toBe(true);
    expect(result.amount).toBe(1200);
    expect(fetchMock).toHaveBeenCalledOnce();
  });
  it('verifies a successful Paystack response and converts kobo to naira', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({
      status: true, data: { status: 'success', reference: 'PST_TEST_123', amount: 250000, currency: 'NGN', metadata: {} },
    }) }));
    const result = await verifyGatewayPayment('paystack', 'PST_TEST_123');
    expect(result.success).toBe(true);
    expect(result.amount).toBe(2500);
  });
});

describe('webhook authentication', () => {
  it('uses the configured Flutterwave webhook secret', () => {
    vi.stubEnv('FLUTTERWAVE_WEBHOOK_SECRET', 'fixture-webhook-secret');
    expect(verifyWebhookSignature('flutterwave', '{}', 'fixture-webhook-secret')).toBe(true);
    expect(verifyWebhookSignature('flutterwave', '{}', 'FLWSECK_TEST-fixture')).toBe(false);
  });

  it('authenticates the exact Paystack webhook payload', () => {
    const body = '{"event":"charge.success"}';
    const signature = createHmac('sha512', 'sk_test_fixture').update(body).digest('hex');
    expect(verifyWebhookSignature('paystack', body, signature)).toBe(true);
    expect(verifyWebhookSignature('paystack', body + ' ', signature)).toBe(false);
  });
});


describe('sandbox refund adapters', () => {
  it('keeps a Flutterwave refund pending until the method confirms disbursement', async () => {
    const data = (status: string) => ({ ok: true, json: async () => ({
      status: 'success', data: { id: 100, status, amount_refunded: 25 },
    }) });
    const gateway = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({
        status: 'success', data: { status: 'successful', tx_ref: 'fixture', amount: 50, currency: 'NGN', id: 42 },
      }) })
      .mockResolvedValueOnce(data('completed'))
      .mockResolvedValueOnce(data('completed-mpgs'));
    vi.stubGlobal('fetch', gateway);
    await expect(submitGatewayRefund('flutterwave', 'fixture', 2500, 'fixture-refund'))
      .resolves.toEqual({ reference: '100', status: 'PROCESSING' });
    await expect(refreshGatewayRefund('flutterwave', '100', 2500))
      .resolves.toEqual({ reference: '100', status: 'SUCCESS' });
    expect(gateway.mock.calls[1][0]).toBe('https://api.flutterwave.com/v3/transactions/42/refund');
  });

  it('refuses a live-mode gateway key before making a network request', async () => {
    vi.stubEnv('PAYSTACK_SECRET_KEY', 'sk_live_fixture');
    const gateway = vi.fn();
    vi.stubGlobal('fetch', gateway);
    await expect(submitGatewayRefund('paystack', 'fixture', 2500, 'fixture-refund')).rejects.toThrow('test key');
    expect(gateway).not.toHaveBeenCalled();
  });
});
