CREATE TABLE "ShipmentTrackingEvent" (
  "id" TEXT NOT NULL,
  "shipmentId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShipmentTrackingEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ShipmentTrackingEvent_shipmentId_eventId_key" ON "ShipmentTrackingEvent"("shipmentId", "eventId");
CREATE INDEX "ShipmentTrackingEvent_shipmentId_occurredAt_idx" ON "ShipmentTrackingEvent"("shipmentId", "occurredAt");
ALTER TABLE "ShipmentTrackingEvent" ADD CONSTRAINT "ShipmentTrackingEvent_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "OrderShipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
