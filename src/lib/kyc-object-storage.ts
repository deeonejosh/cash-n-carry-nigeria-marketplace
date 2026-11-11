import { randomUUID } from 'node:crypto';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const maxEnvelopeBytes = 5 * 1024 * 1024 + 64;

function storage() {
  const bucket = process.env.KYC_S3_BUCKET;
  if (!bucket) {
    if (process.env.KYC_STORAGE_REQUIRED === '1') throw new Error('KYC object storage required');
    return null;
  }
  const endpoint = process.env.KYC_S3_ENDPOINT;
  if (endpoint && new URL(endpoint).protocol !== 'https:') throw new Error('KYC object storage requires HTTPS');
  const client = new S3Client({
    endpoint, region: process.env.KYC_S3_REGION || 'us-east-1',
    forcePathStyle: process.env.KYC_S3_PATH_STYLE === '1', maxAttempts: 2,
  });
  return { client, bucket };
}

export async function storeProtectedDocument(data: Buffer) {
  const target = storage();
  if (!target) return null;
  if (!data.subarray(0, 8).equals(Buffer.from('CNCKYC01')) || data.length > maxEnvelopeBytes) {
    throw new Error('Encrypted KYC envelope required');
  }
  const key = `kyc/${randomUUID()}`;
  try {
    await target.client.send(new PutObjectCommand({
      Bucket: target.bucket, Key: key, Body: data, ContentType: 'application/octet-stream',
      CacheControl: 'private, no-store',
    }), { abortSignal: AbortSignal.timeout(12000) });
    return key;
  } finally {
    target.client.destroy();
  }
}

export async function readProtectedDocument(key: string) {
  if (!/^kyc\/[a-f0-9-]{36}$/.test(key)) throw new Error('Invalid object key');
  const target = storage();
  if (!target) throw new Error('KYC object storage unavailable');
  try {
    const result = await target.client.send(new GetObjectCommand({ Bucket: target.bucket, Key: key }), {
      abortSignal: AbortSignal.timeout(12000),
    });
    if (!result.Body || !result.ContentLength || result.ContentLength > maxEnvelopeBytes) throw new Error('Invalid object length');
    const body = Buffer.from(await result.Body.transformToByteArray());
    if (body.length !== result.ContentLength) throw new Error('Incomplete document');
    return body;
  } finally {
    target.client.destroy();
  }
}
