import { createServer } from 'node:net';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { openDocument, scanDocument, sealDocument } from '@/lib/kyc-document';

afterEach(() => vi.unstubAllEnvs());

describe('KYC document protection', () => {
  it('encrypts documents and rejects tampering and a different owner', () => {
    vi.stubEnv('KYC_DOCUMENT_KEY', 'c1'.repeat(32));
    const file = Buffer.from('%PDF-1.7 fixture');
    const encrypted = sealDocument(file, 'owner');
    expect(encrypted.includes(file)).toBe(false);
    expect(openDocument(encrypted, 'owner')).toEqual(file);
    expect(() => openDocument(encrypted, 'other')).toThrow();
    encrypted[encrypted.length - 1] ^= 1;
    expect(() => openDocument(encrypted, 'owner')).toThrow();
  });

  it.each([
    ['stream: OK', 'clean'], ['stream: Test-Signature FOUND', 'infected'], ['stream: Scanner ERROR', 'error'],
  ])('parses ClamD response %s', async (response, outcome) => {
    const file = Buffer.from('%PDF-1.7 fixture');
    const server = createServer((socket) => {
      let payload = Buffer.alloc(0);
      socket.on('data', (part) => {
        payload = Buffer.concat([payload, part]);
        if (payload.length < 10 + 4 + file.length + 4) return;
        expect(payload.subarray(0, 10).toString()).toBe('zINSTREAM\0');
        expect(payload.readUInt32BE(10)).toBe(file.length);
        expect(payload.subarray(14, 14 + file.length)).toEqual(file);
        socket.end(response + '\0');
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    vi.stubEnv('KYC_CLAMD_SOCKET', '');
    vi.stubEnv('KYC_CLAMD_HOST', '127.0.0.1');
    vi.stubEnv('KYC_CLAMD_PORT', String((server.address() as AddressInfo).port));
    try {
      if (outcome === 'error') await expect(scanDocument(file)).rejects.toThrow();
      else await expect(scanDocument(file)).resolves.toBe(outcome);
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });
});
