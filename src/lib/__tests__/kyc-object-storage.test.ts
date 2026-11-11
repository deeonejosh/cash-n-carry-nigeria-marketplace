import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { readProtectedDocument, storeProtectedDocument } from '@/lib/kyc-object-storage';
import { sealDocument } from '@/lib/kyc-document';

const { send } = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class { send = send; destroy() {} },
  PutObjectCommand: class { constructor(public input: unknown) {} },
  GetObjectCommand: class { constructor(public input: unknown) {} },
}));

beforeEach(() => {
  send.mockReset();
  vi.stubEnv('KYC_S3_BUCKET', 'private-staging-fixture');
  vi.stubEnv('KYC_S3_ENDPOINT', '');
  vi.stubEnv('KYC_DOCUMENT_KEY', 'a1'.repeat(32));
});

afterEach(() => vi.unstubAllEnvs());

it('writes only encrypted bytes and reads from the private object key', async () => {
  const raw = Buffer.from('%PDF-1.7 protected fixture');
  await expect(storeProtectedDocument(raw)).rejects.toThrow('Encrypted KYC envelope required');
  const envelope = sealDocument(raw, 'seller');
  send.mockResolvedValueOnce({});
  const key = await storeProtectedDocument(envelope);
  expect(send.mock.calls[0][0].input).toMatchObject({
    Bucket: 'private-staging-fixture', Key: key, Body: envelope, CacheControl: 'private, no-store',
  });
  expect(send.mock.calls[0][0].input).not.toHaveProperty('ACL');
  send.mockResolvedValueOnce({ ContentLength: envelope.length, Body: { transformToByteArray: async () => envelope } });
  expect(await readProtectedDocument(key!)).toEqual(envelope);
});

it('fails closed if required storage is absent or an endpoint uses HTTP', async () => {
  const envelope = sealDocument(Buffer.from('%PDF fixture'), 'seller');
  vi.stubEnv('KYC_S3_ENDPOINT', 'http://bucket.example.test');
  await expect(storeProtectedDocument(envelope)).rejects.toThrow('requires HTTPS');
  vi.stubEnv('KYC_S3_BUCKET', '');
  vi.stubEnv('KYC_STORAGE_REQUIRED', '1');
  await expect(storeProtectedDocument(envelope)).rejects.toThrow('object storage required');
  expect(send).not.toHaveBeenCalled();
});
