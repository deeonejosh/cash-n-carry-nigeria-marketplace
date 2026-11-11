ALTER TABLE "LiveStream" ADD COLUMN "pinnedProductId" TEXT, ADD COLUMN "pinnedAuctionId" TEXT;
ALTER TABLE "LiveStream" ADD CONSTRAINT "LiveStream_pinnedProductId_fkey" FOREIGN KEY ("pinnedProductId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LiveStream" ADD CONSTRAINT "LiveStream_pinnedAuctionId_fkey" FOREIGN KEY ("pinnedAuctionId") REFERENCES "Auction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
