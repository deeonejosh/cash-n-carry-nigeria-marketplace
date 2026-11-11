import { createHash } from 'node:crypto';
import { prisma } from '@/lib/prisma';

export async function allowAuthAttempt(action: 'login' | 'register', email: string) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 60_000);
  const key = createHash('sha256').update(action + ':' + email).digest('hex');
  const [bucket] = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "AuthRateBucket" ("key", "count", "expiresAt") VALUES (${key}, 1, ${expiresAt})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "AuthRateBucket"."expiresAt" <= ${now} THEN 1 ELSE LEAST("AuthRateBucket"."count" + 1, 9) END,
      "expiresAt" = CASE WHEN "AuthRateBucket"."expiresAt" <= ${now} THEN ${expiresAt} ELSE "AuthRateBucket"."expiresAt" END
    RETURNING "count"
  `;
  return bucket.count <= 8;
}
