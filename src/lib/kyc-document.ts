import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { createConnection } from 'node:net';

const header = Buffer.from('CNCKYC01');

function key() {
  const value = process.env.KYC_DOCUMENT_KEY;
  if (!value) return null;
  if (!/^[a-f\d]{64}$/i.test(value)) throw new Error('KYC document key is invalid');
  return Buffer.from(value, 'hex');
}

export function sealDocument(file: Buffer, userId: string) {
  const secret = key();
  if (!secret) {
    if (process.env.NODE_ENV === 'production') throw new Error('KYC document key unavailable');
    return file;
  }
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', secret, nonce);
  cipher.setAAD(Buffer.from(userId));
  const encrypted = Buffer.concat([cipher.update(file), cipher.final()]);
  return Buffer.concat([header, nonce, cipher.getAuthTag(), encrypted]);
}

export function openDocument(file: Buffer, userId: string) {
  if (!file.subarray(0, header.length).equals(header)) {
    if (process.env.NODE_ENV === 'production') throw new Error('Legacy KYC document requires migration');
    return file;
  }
  const secret = key();
  if (!secret) throw new Error('KYC document key unavailable');
  const nonceEnd = header.length + 12;
  const tagEnd = nonceEnd + 16;
  const decipher = createDecipheriv('aes-256-gcm', secret, file.subarray(header.length, nonceEnd));
  decipher.setAAD(Buffer.from(userId));
  decipher.setAuthTag(file.subarray(nonceEnd, tagEnd));
  return Buffer.concat([decipher.update(file.subarray(tagEnd)), decipher.final()]);
}

export async function scanDocument(file: Buffer): Promise<'clean' | 'infected'> {
  const path = process.env.KYC_CLAMD_SOCKET;
  const host = process.env.KYC_CLAMD_HOST;
  if (!path && !host) {
    if (process.env.NODE_ENV === 'production') throw new Error('KYC scanner unavailable');
    return 'clean';
  }
  const port = Number(process.env.KYC_CLAMD_PORT || '3310');
  if (!path && (!Number.isInteger(port) || port < 1 || port > 65535)) throw new Error('KYC scanner port is invalid');

  return new Promise((resolve, reject) => {
    const socket = createConnection(path ? { path } : { host, port });
    let response = '';
    const deadline = setTimeout(() => socket.destroy(new Error('KYC scan timed out')), 10000);
    socket.once('close', () => {
      clearTimeout(deadline);
      reject(new Error('KYC scanner disconnected'));
    });
    socket.once('error', reject);
    socket.once('connect', () => {
      socket.write('zINSTREAM\0');
      for (let offset = 0; offset < file.length; offset += 65536) {
        const chunk = file.subarray(offset, offset + 65536);
        const size = Buffer.alloc(4);
        size.writeUInt32BE(chunk.length);
        socket.write(size);
        socket.write(chunk);
      }
      socket.write(Buffer.alloc(4));
    });
    socket.on('data', (chunk) => {
      response += chunk.toString('utf8');
      if (response.length > 4096) { socket.destroy(new Error('KYC scanner response too large')); return; }
      const end = response.indexOf('\0');
      if (end < 0) return;
      const result = response.slice(0, end);
      if (result === 'stream: OK') resolve('clean');
      else if (/^stream: .+ FOUND$/.test(result)) resolve('infected');
      else reject(new Error('KYC scan failed'));
      socket.destroy();
    });
  });
}
