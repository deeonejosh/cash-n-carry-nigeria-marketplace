ALTER TABLE "Product" ADD COLUMN "dealPrice" DECIMAL(12,2), ADD COLUMN "dealStartsAt" TIMESTAMP(3), ADD COLUMN "dealEndsAt" TIMESTAMP(3), ADD COLUMN "dealRemaining" INTEGER;
ALTER TABLE "OrderItem" ADD COLUMN "dealStartsAt" TIMESTAMP(3);
ALTER TABLE "Product" ADD CONSTRAINT "Product_flash_deal_valid" CHECK (
  ("dealPrice" IS NULL AND "dealStartsAt" IS NULL AND "dealEndsAt" IS NULL AND "dealRemaining" IS NULL)
  OR ("dealPrice" IS NOT NULL AND "dealPrice" > 0 AND "dealStartsAt" IS NOT NULL AND "dealEndsAt" IS NOT NULL AND "dealStartsAt" < "dealEndsAt" AND "dealRemaining" IS NOT NULL AND "dealRemaining" >= 0)
);

CREATE FUNCTION cnc_notify_marketplace() RETURNS trigger AS $$
BEGIN
  IF TG_TABLE_NAME = 'Message' THEN
    IF NEW."receiverId" IS NOT NULL THEN
      PERFORM pg_notify('cnc_marketplace', json_build_object('userId', NEW."receiverId", 'kind', 'message')::text);
    END IF;
  ELSE
    PERFORM pg_notify('cnc_marketplace', json_build_object('userId', NEW."userId", 'kind', 'notification')::text);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Message_notify" AFTER INSERT ON "Message" FOR EACH ROW EXECUTE FUNCTION cnc_notify_marketplace();
CREATE TRIGGER "Notification_notify" AFTER INSERT ON "Notification" FOR EACH ROW EXECUTE FUNCTION cnc_notify_marketplace();
