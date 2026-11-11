import { NextResponse } from 'next/server';
import { getAuthUserFromRequest, requireRole } from '@/lib/auth';
import { Role } from '@prisma/client';

export async function withAuth(req: Request, allowedRoles: Role[] = [Role.BUYER, Role.SELLER, Role.ADMIN]) {
  const auth = await getAuthUserFromRequest(req);
  if (!auth || !requireRole(auth, allowedRoles)) {
    return { ok: false, response: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }) } as const;
  }

  return { ok: true, auth } as const;
}
