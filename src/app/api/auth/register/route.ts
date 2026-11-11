import { allowAuthAttempt } from '@/lib/auth-throttle';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword, createSession, setSessionCookie } from '@/lib/auth';
import { registerSchema } from '@/lib/validators';

export async function POST(req: Request) {
  try {
    const parsed = registerSchema.parse(await req.json());
    const email = parsed.email.trim().toLowerCase();
    if (!(await allowAuthAttempt('register', email))) {
      return NextResponse.json({ success: false, error: 'Too many attempts. Try again shortly.' }, { status: 429 });
    }
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return NextResponse.json({ success: false, error: 'Email already exists' }, { status: 409 });

    // Public registration can never grant seller or admin privileges.
    const user = await prisma.user.create({ data: { email, name: parsed.name.trim(), role: 'BUYER', passwordHash: await hashPassword(parsed.password) } });
    const session = await createSession(user, req.headers.get('user-agent'));
    const response = NextResponse.json({ success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } }, { status: 201 });
    setSessionCookie(response, session.token, session.expiresAt);
    return response;
  } catch (error) {
    const status = error instanceof Error && error.name === 'ZodError' ? 400 : 500;
    return NextResponse.json({ success: false, error: status === 400 ? 'Invalid request payload' : 'Registration unavailable' }, { status });
  }
}
