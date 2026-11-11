ALTER TYPE "ActivityType" ADD VALUE 'DISPUTE_OPENED' BEFORE 'ORDER_REFUNDED';
ALTER TYPE "ActivityType" ADD VALUE 'DISPUTE_RESOLVED' BEFORE 'ORDER_REFUNDED';
CREATE TABLE "AuthRateBucket" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AuthRateBucket_pkey" PRIMARY KEY ("key")
);
CREATE INDEX "AuthRateBucket_expiresAt_idx" ON "AuthRateBucket"("expiresAt");
