CREATE TABLE "OrderShipment" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "sellerId" TEXT NOT NULL,
  "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
  "carrier" TEXT,
  "trackingRef" TEXT,
  CONSTRAINT "OrderShipment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OrderShipment_orderId_sellerId_key" ON "OrderShipment"("orderId", "sellerId");
CREATE INDEX "OrderShipment_sellerId_idx" ON "OrderShipment"("sellerId");
ALTER TABLE "OrderShipment" ADD CONSTRAINT "OrderShipment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderShipment" ADD CONSTRAINT "OrderShipment_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "SellerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderItem" ADD COLUMN "shipmentId" TEXT;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "OrderShipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
