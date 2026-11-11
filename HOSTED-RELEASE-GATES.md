# Hosted staging and release gates

Baseline: `development/staging-verification` at `3979cbb17b89a2b208c208c434152acaffaa1a92`. The exported baseline matched the previous ZIP byte for byte. This update preserves the existing routes and UI and adds deployment packaging, object storage, and payout accounting.

## Deploy an independent staging instance

1. Provision a fresh PostgreSQL database with a staging-specific name, a private S3-compatible bucket, a private ClamAV daemon with current signatures, and a Node 24 service behind HTTPS. Confirm independently that none of the services are shared with production. Keep staging ingress private except for the provider callback routes that need to receive public events.
2. Set variables from `.env.example` using the host's secret manager. Use a separate `NEXT_PUBLIC_APP_URL`, `DATABASE_URL`, `EVENTS_DATABASE_URL` where needed, `JWT_SECRET`, and `KYC_DOCUMENT_KEY`. Use a workload role or scoped bucket credentials with PutObject/GetObject access to the staging `kyc/` prefix. Block public access on the bucket. The app encrypts each file before object storage.
3. Run `npm ci`, `npm run prisma:generate`, and `npm run build`, or build the supplied Dockerfile. Run `npx prisma migrate deploy` as a one-off job using the dedicated staging connection. Start the application with `npm run start:staging`. Terminate TLS at the hosting ingress, forward requests to the configured Node port, and avoid buffering SSE.
4. Configure `SELLER_COMMISSION_BPS` explicitly, including zero if approved for staging. Configure the KYC bucket and private ClamAV endpoint. Use a private endpoint or private network for ClamAV transport. Retain encrypted document versions according to the operator's policy and reconcile unreferenced objects after failed or superseded uploads. Keep encryption keys in managed backups and test recovery. Existing database-backed documents remain readable under their existing encryption requirements.
5. Verify `/api/health` and schedule `npm run reservations:expire` against staging. Use synthetic users, products and identity documents. Set payment credentials to sandbox keys only.

The staging launcher checks the hostname, HTTPS scheme, database naming, test-key prefixes and required KYC settings. These are guardrails. The operator must verify that the configured infrastructure is independent. Container build and deployment still need an available container host.

## Provider acceptance and blockers

| Gate | Current evidence | Required to close |
| --- | --- | --- |
| Hosted HTTPS and object storage | Container and startup configuration supplied. Local HTTPS uses a separate PostgreSQL database. S3 client writes sealed KYC envelopes and the app serves downloads through the admin-authorised route. | Provision an independent hosted service, database and private bucket, then test bucket policy, retention and access with the real infrastructure. |
| LiveKit | Existing room and role-scoped token implementation retained. Browser covers the unavailable-configuration path. | Configure staging LiveKit. Test on separate seller and buyer devices, including camera, microphone, chat, counts, pins, auctions, moderator removal, and a network interruption followed by reconnect. |
| Payment sandboxes | Fixture coverage includes signatures, duplicates, failures, refunds and order reconciliation. Launcher rejects live keys. | Register `/api/payments/webhooks/paystack` and `/api/payments/webhooks/flutterwave` against the new HTTPS origin and run both test checkouts, callback replay and actual sandbox refunds. |
| Seller verification | ClamAV protocol fixture and encrypted upload, access control, download and approval tests. | Configure a real scanner and verify signatures, clean and rejected uploads, daemon failure, audit logs and key recovery. Identity-provider configuration and verification are still open. |
| Net settlement and payouts | Drafts subtract confirmed linked refunds and configured commission, with half-up rounding to the kobo. Draft eligibility still requires delivery and known refund outcomes. Commission amount and rate are recorded. | Approve fees, tax and transfer policy. Provider fees, withholding, transfer verification, and actual payout execution are outside this build. Fund transfers remain disabled. |
| Fulfilment | Existing signed carrier events, shipment tracking, partial returns and refund reconciliation passed the database suite with fixtures. | Configure a real carrier adapter and validate delivery and return events against its sandbox. |

GitHub synchronisation was not attempted because authorised access had not been established. See `STAGING-VERIFICATION.md` for later reconciliation instructions. No production website, database, payment or hosting change was made.

S3 SDK reference: https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/s3/command/PutObjectCommand/

## Executed verification

- Clean dependency installation, Prisma validation and client generation, all 18 migrations, development seeding, and schema comparison passed on fresh isolated PostgreSQL. Prisma detected no drift.
- All 16 automated tests passed, including fixture-backed payment/refund reconciliation, seller permissions, carrier events, partial returns, payout commission, private encrypted object-storage commands, auction concurrency, and coin-ledger integrity.
- Lint, route type generation, TypeScript, reservation worker, and the production build passed. The final npm dependency audit reported zero known advisories.
- The hosted staging launcher served the production build over loopback HTTPS with a dedicated database. It rejected the production hostname and a live-key fixture before startup.
- Chromium passed with encrypted KYC documents stored through an S3-compatible HTTPS fixture and a ClamAV protocol fixture. The browser verified the PostgreSQL record stored an object key rather than document bytes, buyer download was denied, and the authorised admin retrieved the original document before approval. The same browser suite passed with the existing database storage path.
- The loopback load test delivered one event to 48 of 48 streams at 18 ms p95. This measures the local environment only.
- Public hosting, real cloud bucket permissions, real ClamAV signature scanning, actual payment callbacks, identity verification, carrier sandbox and two-device LiveKit media remain unverified.
