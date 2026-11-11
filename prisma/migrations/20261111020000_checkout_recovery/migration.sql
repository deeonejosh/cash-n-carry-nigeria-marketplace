ALTER TYPE "ActivityType" ADD VALUE 'ORDER_STATUS_CHANGED' BEFORE 'ORDER_REFUNDED';
ALTER TYPE "ActivityType" ADD VALUE 'KYC_DOCUMENT_ACCESSED' BEFORE 'ORDER_REFUNDED';
ALTER TABLE "Order" ADD COLUMN "checkoutKey" TEXT, ADD COLUMN "reservationEnds" TIMESTAMP(3);
ALTER TABLE "Payment" ADD COLUMN "checkoutUrl" TEXT;
CREATE UNIQUE INDEX "Order_userId_checkoutKey_key" ON "Order"("userId", "checkoutKey");
CREATE INDEX "Order_status_reservationEnds_idx" ON "Order"("status", "reservationEnds");

CREATE TABLE "Address" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Address_userId_createdAt_idx" ON "Address"("userId", "createdAt");
ALTER TABLE "Address" ADD CONSTRAINT "Address_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SellerKyc" ADD COLUMN "documentData" BYTEA;
