ALTER TABLE "Message" ADD COLUMN "deliveredAt" TIMESTAMP(3);

CREATE FUNCTION cnc_notify_delivery() RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('cnc_marketplace', json_build_object('userId', NEW."senderId", 'kind', 'receipt')::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Message_receipt_notify" AFTER UPDATE OF "deliveredAt" ON "Message"
FOR EACH ROW WHEN (OLD."deliveredAt" IS NULL AND NEW."deliveredAt" IS NOT NULL)
EXECUTE FUNCTION cnc_notify_delivery();
