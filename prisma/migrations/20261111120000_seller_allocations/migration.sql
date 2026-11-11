CREATE TABLE "SellerSettlement" (
  "id" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "sellerId" TEXT NOT NULL,
  "gross" DECIMAL(12,2) NOT NULL,
  "currency" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SellerSettlement_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SellerSettlement_paymentId_sellerId_key" ON "SellerSettlement"("paymentId", "sellerId");
CREATE INDEX "SellerSettlement_sellerId_createdAt_idx" ON "SellerSettlement"("sellerId", "createdAt");
ALTER TABLE "SellerSettlement" ADD CONSTRAINT "SellerSettlement_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SellerSettlement" ADD CONSTRAINT "SellerSettlement_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "SellerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
