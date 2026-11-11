# Cash N Carry Nigeria Rebuild

Next.js 15, React 19, TypeScript, Tailwind CSS, Prisma 5 and PostgreSQL. The rebuild is independent of the live Cash N Carry website.

## Local setup

Use Node.js 22.12+ or Node.js 24 and a new local PostgreSQL database.

```bash
npm ci
cp .env.example .env
openssl rand -base64 48
```

Set `JWT_SECRET` to the generated value. Set `DATABASE_URL` to the local database and `NEXT_PUBLIC_APP_URL` to the application origin. The defaults use `cash_n_carry_dev` and port 3000.

```bash
npx prisma validate
npm run prisma:generate
npx prisma migrate deploy
npm run prisma:seed
npm run dev
```

Seeding is optional. It adds demo catalog records and accounts with generated passwords. It accepts an empty loopback database whose name ends in `_dev` or `_test`. Create buyer accounts through Profile. To exercise admin review locally, use Prisma Studio on your disposable database and set a dedicated test user's role to `ADMIN`.

## Migration history

The generated PostgreSQL baseline is for a new database. It replaces SQLite SQL in the uploaded snapshot. A database with existing records or recorded migration history needs a separately reviewed, data-preserving migration. For a SQLite migration, map and validate the source data, import into a fresh PostgreSQL target, and reconcile row counts, keys and money fields before considering a cutover.

## Payments

The payment API accepts sandbox keys only. Set `PAYSTACK_SECRET_KEY` to a Paystack test key or `FLUTTERWAVE_SECRET_KEY` to a Flutterwave v3 test key. For Flutterwave webhooks, configure `FLUTTERWAVE_WEBHOOK_SECRET` to match the provider dashboard's v3 secret hash. Paystack currently uses the legacy `x-paystack-signature` webhook header. Sandbox callback and webhook delivery need a reachable test origin. CI fixtures stub provider calls.

## Verification

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

To include the PostgreSQL integration test, point `DATABASE_URL` at an isolated, migrated loopback database ending in `_test`, export a local `JWT_SECRET`, and run `RUN_POSTGRES_TESTS=1 npm test`. The test creates fixture records in that database.

## Browser tests

Seed a fresh loopback database ending in `_test`. Start the built app locally with gateway keys unset for the missing-key checkout scenario. Run:

```bash
BROWSER_BASE_URL=http://localhost:3109 CHROMIUM_PATH=/path/to/chromium npm run test:browser
```

The app must be listening at the given origin, and the browser script must inherit the same `DATABASE_URL` as the app. Set `BROWSER_VIDEO_FIXTURE` to a small playable MP4 to include the video scenario. Test fixtures create disposable users, orders and seller listings.

## Isolated staging deployment

Use a separate database, application origin and credentials for this independent rebuild. Build with `npm ci`, `npm run prisma:generate` and `npm run build`. Apply the migrations with `npx prisma migrate deploy` before starting the Node server with `npm start`. Set `NEXT_PUBLIC_APP_URL` to the HTTPS staging origin. Use provider test credentials only. Configure the relevant sandbox callback URLs on that origin and restrict staging access as appropriate.

Schedule `npm run reservations:expire` at least once a minute with the same database configuration. It releases unused order reservations, expired auctions without buyers, and winning auctions past their claim window. It also removes expired auth-throttle entries. Reservations with a payment attempt remain held until reconciliation confirms the outcome. Checkout links and verification are available in order history. An uncertain gateway response needs operator review before a fresh attempt.

Local PDF and MP4 uploads are stored in PostgreSQL. Before handling real seller documents or sustained media traffic, configure private storage, malware scanning, retention controls, and monitored delivery. For video at scale, add transcoding and CDN delivery. The LiveKit SDK integration requires a staging LiveKit project. Configure `LIVEKIT_URL`, `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET` on the server and use HTTPS on staging. A real two-device seller broadcast and buyer playback test remains required. Live chat is ephemeral. Viewer counts represent room connections and moderator removal disconnects a participant session.

For push events set `EVENTS_DATABASE_URL` to a direct or session-pooled connection if `DATABASE_URL` uses transaction pooling. PostgreSQL LISTEN requires a session connection. Keep server-sent events unbuffered and allow at least 55 seconds per request on the staging proxy. This build uses one PostgreSQL listener per Node process and limits simultaneous streams to 256 and falls back to periodic refresh if a connection is unavailable.

Sandbox refunds can be submitted and checked from the admin console using test keys. A transport failure keeps the attempted amount reserved until an operator reconciles it. Checkout callbacks and refund status changes still require validation against both provider sandboxes. Gross seller allocations record captured line totals. They do not calculate fees, allocate partial refunds, represent payout balances, or initiate transfers.

KYC approval references the uploaded PDF version. Use an isolated test document for staging. Production identity verification, malware scanning, retention controls, and private storage configuration still require integration and review.

See `VERIFICATION.md` for completed workflows and remaining gaps.

## Current staging workflow

See `STAGING-VERIFICATION.md` for the HTTPS staging checks, provider setup, known gaps and GitHub sync procedure. The KYC path in production mode requires both a private ClamD endpoint and a per-environment encryption key. Preserve the key in the environment's secret manager and backups. Losing it makes encrypted documents unreadable. Legacy unencrypted documents are rejected by the production download path and require a controlled migration before use.

The events service now shares one PostgreSQL LISTEN connection per Node process with up to 256 event streams. This cap is a guard, not a capacity claim. Keep the prior proxy and direct database guidance. Delivery means a recipient inbox acknowledged receipt, independent of whether the recipient read the message.

For the container build, private KYC object storage, staging launcher and current release gates, see `HOSTED-RELEASE-GATES.md`.
