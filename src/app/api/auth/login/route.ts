import { allowAuthAttempt } from '@/lib/auth-throttle';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPassword, createSession, setSessionCookie } from '@/lib/auth';
import { loginSchema } from '@/lib/validators';

export async function POST(req: Request) {
  try {
    const payload = loginSchema.parse(await req.json());
    const email = payload.email.trim().toLowerCase();
    if (!(await allowAuthAttempt('login', email))) {
      return NextResponse.json({ success: false, error: 'Too many attempts. Try again shortly.' }, { status: 429 });
    }
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive || !(await verifyPassword(payload.password, user.passwordHash))) {
      return NextResponse.json({ success: false, error: 'Invalid credentials' }, { status: 401 });
    }
    const session = await createSession(user, req.headers.get('user-agent'));
    const response = NextResponse.json({ success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    setSessionCookie(response, session.token, session.expiresAt);
    return response;
  } catch (error) {
    const status = error instanceof Error && error.name === 'ZodError' ? 400 : 500;
    return NextResponse.json({ success: false, error: status === 400 ? 'Invalid payload' : 'Login unavailable' }, { status });
  }
}
