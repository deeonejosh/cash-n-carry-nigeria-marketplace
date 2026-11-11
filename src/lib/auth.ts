import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export type AuthTokenPayload = {
  sub: string;
  email: string;
  role: Role;
  jti: string;
};

const COOKIE_NAME = 'cnc_session';
const SESSION_DAYS = 7;

function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error('JWT_SECRET must be set to at least 32 characters');
  return secret;
}

const digest = (value: string) => crypto.createHash('sha256').update(value).digest('hex');

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(user: { id: string; email: string; role: Role }, userAgent?: string | null) {
  const jti = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const token = jwt.sign({ sub: user.id, email: user.email, role: user.role, jti }, jwtSecret(), { expiresIn: `${SESSION_DAYS}d`, issuer: 'cash-n-carry' });
  await prisma.session.create({ data: { id: jti, userId: user.id, tokenHash: digest(token), expiresAt, userAgent: userAgent?.slice(0, 300) ?? null } });
  return { token, expiresAt };
}

export function setSessionCookie(response: { cookies: { set: (name: string, value: string, options: Record<string, unknown>) => void } }, token: string, expiresAt: Date) {
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
}

export function clearSessionCookie(response: { cookies: { set: (name: string, value: string, options: Record<string, unknown>) => void } }) {
  response.cookies.set(COOKIE_NAME, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', expires: new Date(0) });
}

function readCookie(req: Request, name: string) {
  const raw = req.headers.get('cookie') ?? '';
  const cookie = raw.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  if (!cookie) return null;
  try {
    return decodeURIComponent(cookie.slice(name.length + 1));
  } catch {
    return null;
  }
}

export async function getAuthUserFromRequest(req: Request): Promise<AuthTokenPayload | null> {
  const token = readCookie(req, COOKIE_NAME) ?? (req.headers.get('authorization')?.startsWith('Bearer ') ? req.headers.get('authorization')!.slice(7).trim() : null);
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, jwtSecret(), { issuer: 'cash-n-carry', algorithms: ['HS256'] }) as AuthTokenPayload;
    if (!decoded.jti || !decoded.sub) return null;
    const session = await prisma.session.findFirst({ where: { id: decoded.jti, userId: decoded.sub, tokenHash: digest(token), revokedAt: null, expiresAt: { gt: new Date() } } });
    if (!session) return null;
    const user = await prisma.user.findUnique({ where: { id: decoded.sub }, select: { id: true, email: true, role: true, isActive: true } });
    if (!user?.isActive) return null;
    return { sub: user.id, email: user.email, role: user.role, jti: decoded.jti };
  } catch {
    return null;
  }
}

export async function revokeSession(req: Request) {
  const token = readCookie(req, COOKIE_NAME);
  if (!token) return;
  try {
    const decoded = jwt.verify(token, jwtSecret(), { issuer: 'cash-n-carry', algorithms: ['HS256'] }) as AuthTokenPayload;
    await prisma.session.updateMany({ where: { id: decoded.jti, userId: decoded.sub, revokedAt: null }, data: { revokedAt: new Date() } });
  } catch {
    // Expired/invalid sessions are already unusable.
  }
}

export function requireRole(user: AuthTokenPayload | null, roles: Role[]) {
  return Boolean(user && roles.includes(user.role));
}
