CREATE TABLE "PayoutDraft" (
  "id" TEXT NOT NULL,
  "settlementId" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL CHECK ("amount" > 0),
  "currency" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "preparedBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PayoutDraft_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PayoutDraft_settlementId_key" ON "PayoutDraft"("settlementId");
ALTER TABLE "PayoutDraft" ADD CONSTRAINT "PayoutDraft_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "SellerSettlement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
