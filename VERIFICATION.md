# Cash N Carry rebuild verification

Baseline archive: `Cash-N-Carry-Repaired-Source.zip`. The exported ZIP from local baseline commit `592a6f906a74915079fe6989d8058efcb1ce1817` matched the existing archive byte for byte. GitHub returned 404 for the repository and remote comparison was unavailable. Development branch: `development/marketplace-completion`.

| Area | Delivered and tested | Remaining scope |
| --- | --- | --- |
| Buyer account and catalog | PostgreSQL registration and login, account throttling, published catalog search and filters, product details, saved addresses and wishlist. | Email verification, password recovery and extended profile settings. |
| Cart, checkout and orders | Inventory reservation, concurrent checkout retry, insufficient-stock rejection, order history, status tracking, address selection, expiry of orders with no payment attempt and restart from order history. | Cart cleanup after settlement, abandoned attempted-payment reconciliation and carrier tracking. |
| Payments | Test keys enforced. Mocked Paystack initialization, repeated checkout link, temporary verification failure, replayed webhook and settlement passed in PostgreSQL. Flutterwave verification and signature fixtures passed. | Real provider sandbox checkout and callback delivery require test credentials and a reachable HTTPS staging origin. Provider refunds and recovery of ambiguous or duplicate charges remain open. |
| Notifications and messages | Account-scoped inbox, direct seller messages and replies, five-second browser polling, notifications for order progression and dispute resolution. | WebSocket or push delivery, unread messaging state and large inbox pagination. |
| Seller and KYC | PostgreSQL seller application, bounded private PDF upload, admin-only audited downloads, approval, storefront metadata, product drafts, optimistic stock updates, single-seller packing and shipping, and gross paid sales. | Identity verification, malware scanning, extended storefront settings, multi-seller fulfilment, detailed analytics, net finance and payouts. |
| Admin | Seller review, product publication and moderation, order progression, disputes, buyer suspension and session revocation, and promotional coin credits. Server-side role enforcement and related audit entries. | Role management UI, provider refunds and livestream moderation. |
| Shoppable video | Bounded MP4 upload, product tagging, vertical video list, media byte ranges, comments, likes, follows and share links. Admin hide action prevents further serving. | Media pipeline, account quotas beyond daily upload limits, moderation console and content reporting. |
| Auctions | Server-side bid timing and pricing, row locking, duplicate concurrent bid rejection, one-unit reservations, winner claim with a single order, and worker-based expiry. | Push updates, auction notifications and flash deals. |
| Promotional gifts | Admin credits, wallet history, fixed-price storefront gifts, local animation, idempotent credits and concurrent ledger balance checks. | Livestream gifts, coin purchases, payouts and monetisation. |
| Livestream | Existing landing-page preview remains. | Broadcasting, playback, chat, presence and pinned products require a real streaming integration and test infrastructure. |
| Design | Green, white and orange design retained. Mobile navigation uses For You, Shop, +, Messages and Profile. | Responsive review beyond the exercised browser routes. |

The live Cash N Carry site, production database and live payment credentials were outside the test environment.

## Final run

- Clean `npm ci` succeeded.
- Prisma schema validation and client generation succeeded.
- All seven migrations and the development seed succeeded on fresh isolated PostgreSQL 18.6. Migration status was up to date and the schema drift check reported no differences.
- Vitest passed six tests across two suites. The PostgreSQL workflow includes simultaneous checkout retries, insufficient inventory, abandoned reservation recovery, a mocked gateway verification failure and successful replay, KYC access controls, product moderation, concurrent auction bids and winner claims, simultaneous gift debit protection, disputes, video interactions, per-account auth throttling, seller fulfilment and buyer session revocation.
- The reservation worker ran successfully, and lint, TypeScript and the production build passed.
- Chromium passed the mobile buyer checkout and recovery journey, seller PDF upload, desktop admin approval, product publication and buyer suspension. A generated MP4 was uploaded, tagged to a product, loaded video metadata in Chromium and received a persisted like. Gateway calls in automated tests used fixtures. The browser checkout tested the disabled-provider response.
