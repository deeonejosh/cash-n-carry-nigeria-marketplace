# Cash N Carry staging verification

Source baseline: `development/production-readiness` at `5d55f9edbfa9f15ea715501f3783c43e2475ca15`. The local baseline exported byte-for-byte identically to the prior ZIP. Changes are on `development/staging-verification`. GitHub returned 404, and upstream source and history could not be compared.

## Verification matrix

| Workflow | Implemented or locally verified | Remaining gate |
| --- | --- | --- |
| LiveKit | Existing LiveKit SDK integration and locally verified role-scoped tokens remain available. | Hosted LiveKit staging credentials, public HTTPS, and two-device media, chat, controls, pins and moderation checks. A provider release download attempt timed out. |
| Paystack and Flutterwave | Test-only keys remain enforced. Checkout, callback signatures, refund verification, ambiguous outcomes and replay protections are covered by fixtures. | Actual checkout, signed public callbacks, payment reconciliation and actual sandbox refund status transitions need credentials and a reachable callback origin. |
| Seller accounting | Captured gross allocations, eligible payout drafts adjusted for confirmed item returns, and stale drafts on refund initiation. Unknown and unattributed refunds block draft creation. | Fees, tax, payout approval, provider transfer records, recipient verification and transfers. Drafts never initiate a payout. |
| KYC | ClamD INSTREAM client, bounded file scan, authenticated AES-256-GCM encryption bound to the applicant, private versioned admin download. Browser used a loopback ClamD protocol fixture. | A real ClamD deployment with current signatures, operational key rotation, protected backups and retention policy, legacy document migration, and identity-provider verification. |
| Carrier tracking | Signed normalised events, timestamp checks, shipment/tracking matching, deduplication, tracking timeline and buyer notification. | Configure a real carrier adapter and verify events in that carrier's sandbox. Carrier reports are displayed separately from admin-confirmed fulfilment state. |
| Partial returns | Item-level quantities, buyer ownership and replay controls, admin approval and receipt, exact sandbox refund linkage and partial refund state. | Real sandbox refund settlement, warehouse inspection/restock policy, and multi-item return logistics. |
| Messaging | Recipient-only delivery acknowledgement, sender receipt event, shared PostgreSQL listener and reconnection handling. | Measure latency and fan-out on the eventual hosted environment and test reconnect behaviour during database failover. |
| Hosted staging | A separate production-mode Node instance was exercised over loopback HTTPS with a fresh PostgreSQL database and a per-run key. | Public isolated staging deployment, separate hosted PostgreSQL, and provider test credentials. The loopback instance is disposable. |

## External staging and provider acceptance

1. Provision a new private staging project and PostgreSQL database. Use a non-production hostname and credentials. Set `DATABASE_URL`, `JWT_SECRET`, and `NEXT_PUBLIC_APP_URL` to that environment's configuration. Set `EVENTS_DATABASE_URL` if using transaction pooling.
2. Run `npm ci`, `npm run prisma:generate`, `npx prisma migrate deploy`, `npm run build` and `npm start` on the isolated application. Schedule `npm run reservations:expire`. Keep HTTPS and streaming enabled on the ingress and test `/api/health`.
3. Configure `KYC_DOCUMENT_KEY` from the secret manager and a private `KYC_CLAMD_SOCKET` or `KYC_CLAMD_HOST` and port. Validate clean, rejected and scanner-unavailable cases with isolated test documents. Confirm real scanner signature updates and document retention policy before approval.
4. Configure the server-only LiveKit staging values in `.env.example`. Use a seller device and a distinct buyer device to confirm camera and microphone access, playback, viewer counts, chat, pins and moderation.
5. Configure sandbox keys only and register each provider callback against the new HTTPS staging origin. Verify both gateways from initiation through a test payment, the callback, payment status and an item refund. Record provider transaction and refund references without capturing secrets or payment data.
6. Connect a trusted carrier adapter to `POST /api/shipments/carrier`. Send `shipmentId`, `carrier`, `trackingRef`, `eventId`, `status` and `occurredAt`. Use `x-cnc-timestamp` with Unix seconds and `x-cnc-signature` with the hex HMAC-SHA256 of the timestamp, a period, and the raw body. Map provider events to the supported statuses in the route.
7. Complete identity verification, net seller settlement rules and transfer integration before any production approval.

## GitHub synchronisation after access is restored

Clone the remote and inspect its default branch and latest changes. Check whether the local baseline commit is present. If it is, compare the archive with that baseline and apply the changes to a new branch based on the latest compatible remote commit. If the local baseline is absent, compare the extracted source with the remote tree and reconcile the files and migrations explicitly. Keep remote-only changes. Run the verification suite against the reconciled tree, then push the new branch and open a PR. Avoid force-pushing or replacing the default branch.

The production site and database were outside the environment. Live transactions were disabled throughout.

## Final run results

- Clean install on Node.js 24.22.1, Prisma schema validation and client generation, all 16 migrations and the development seed passed on a fresh PostgreSQL 18.6 database. Prisma detected no schema drift.
- All 12 Vitest tests passed. The database workflow exercised checkout and payment failure fixtures, refund and return accounting, payout draft invalidation, carrier signature and replay checks, receiver-only delivery receipts, auction concurrency and gift ledger integrity.
- Lint, route type generation, TypeScript, reservation worker and the Next.js production build passed.
- Chromium passed against the temporary HTTPS origin with its generated certificate pinned. Coverage included buyer checkout recovery, KYC submission with the ClamD protocol fixture, encrypted storage, buyer download denial, authenticated admin download and approval, push inbox updates and delivery receipts, product moderation and video playback metadata.
- The loopback HTTPS load check delivered one database event to 48 of 48 open streams, with 17 ms p95 and maximum observed fan-out latency. This is a single local measurement.
- The final npm lockfile audit reported zero advisories across production and development dependencies. Runtime upgrades included Next.js 15.5.29, React 19.3.1, Zod 4.6.7 and PostCSS 8.5.32. Test tooling was upgraded to Vitest 5.1.0 and Vite 8.3.8.
- The actual LiveKit media path, public callbacks, payment sandboxes, production scanner and identity provider did not run.

ClamD protocol reference: https://docs.clamav.net/manual/Usage/ClamdProtocol.html
