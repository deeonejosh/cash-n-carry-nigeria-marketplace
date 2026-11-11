import { NextResponse } from 'next/server';
import { clearSessionCookie, getAuthUserFromRequest, revokeSession } from '@/lib/auth';

export async function GET(req: Request) {
  const auth = await getAuthUserFromRequest(req);
  if (!auth) return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
  return NextResponse.json({ authenticated: true, user: { id: auth.sub, email: auth.email, role: auth.role } });
}

export async function DELETE(req: Request) {
  await revokeSession(req);
  const response = NextResponse.json({ success: true });
  clearSessionCookie(response);
  return response;
}
