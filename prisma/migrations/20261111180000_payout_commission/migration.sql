ALTER TABLE "PayoutDraft"
  ADD COLUMN "commissionBps" INTEGER NOT NULL DEFAULT 0 CHECK ("commissionBps" BETWEEN 0 AND 10000),
  ADD COLUMN "commissionAmount" DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK ("commissionAmount" >= 0);
