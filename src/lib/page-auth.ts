import { headers } from 'next/headers';
import { getAuthUserFromRequest } from '@/lib/auth';

export async function getPageUser() {
  return getAuthUserFromRequest(new Request('http://localhost', { headers: await headers() }));
}
