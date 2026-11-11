# Cloudflare staging deployment (NOT production)

This is a staging-only Cloudflare `cf` CLI subproject. GitHub Actions builds the existing
Node 24 app Dockerfile and publishes it as a Cloudflare Container behind a new Worker.

## Existing resources verified
- Cloudflare account: `508a24cccf3f5f764015a27fa1bb0f15`
- Private R2 bucket: `cashncarry-staging-private`
- Neon PostgreSQL project: `cool-math-55005209`, database `cashncarry_staging`
- Target Worker **proposed**: `cashncarry-staging-worker`
- Target container application **proposed**: `cashncarry-staging-app`

## Blockers to clear before running
1. GitHub repository `deeonejosh/cash-n-carry-nigeria-rebuild` currently returned 404
   through the connected GitHub app. Upload source to a repository with Actions enabled
   and verify it contains **all** project files, not only the ZIP.
2. Create a GitHub Environment `cashncarry-staging`, restrict deployment branches to
   `deployment/cloudflare-staging`, and preferably require manual review.
3. Add GitHub Environment secrets:
   - `CLOUDFLARE_STAGING_API_TOKEN`: scoped token with Workers scripts, Containers,
      Durable Objects and image registry permissions required by Cloudflare CLI.
   - `NEON_STAGING_DIRECT_URL`: Neon **direct** connection string to `cashncarry_staging`,
      never production. Apply DB migrations only from this URL.
4. Provision independent Worker secrets directly on the *staging Worker* using
   Cloudflare's Secrets Store or a supported secure CLI flow (not in Git):
   `DATABASE_URL`, `EVENTS_DATABASE_URL`, `JWT_SECRET`, `KYC_DOCUMENT_KEY`,
   `KYC_S3_ENDPOINT`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `KYC_CLAMD_HOST`.
5. The S3 endpoint should be the account-scoped R2 URL and credentials should be
   restricted to the `cashncarry-staging-private` bucket. R2 must remain private.
6. Deploy a private ClamAV service reachable from the Cloudflare container.
   **ClamAV TCP has no TLS**; never expose its port publicly or use an untrusted
   endpoint. This is a genuine unresolved infrastructure requirement.
7. The configuration currently uses a staging-only commission rate of 0 basis
   points for synthetic testing; obtain approval before real settlement testing.
8. Confirm the target worker subdomain in the Cloudflare dashboard:
   `cashncarry-staging-worker.cashncarry-workforce-2026.workers.dev`.

## Important secret/bootstrap caveat
Worker secrets must be created on the correct Worker before the application can
start. If Cloudflare CLI cannot deploy a Worker whose declared secrets do not yet
exist, first perform a staging-only bootstrap using the approved Cloudflare secret
management path. Never generate/print real secrets inside a GitHub Actions log.

## Deployment
1. Upload this unpacked source code to the staging GitHub repository.
2. Configure the required GitHub Environment and secrets as described above.
3. Select **Actions → Cash N Carry — Cloudflare staging ONLY → Run workflow**,
   branch `deployment/cloudflare-staging` and input `DEPLOY_STAGING_ONLY`.
4. Inspect the workflow logs. A successful `cf deploy` is **not** proof the app is
   healthy; the workflow checks the public HTTPS `/api/health` and the Neon DB.
5. Real LiveKit, payment sandbox callbacks, ClamAV scanning and R2 object permissions
   require independent end-to-end testing. This workflow does not mark them passed.

## Cost and protection
The Cloudflare Container instance is capped at `maxInstances: 1` in config.
Cloudflare charges and Neon consumption may still accrue. No production route is
configured. `cashncarryng.com` is blocked both by Worker routing and by the existing
Node staging launcher; do not remove either protection.

## Cloudflare CLI note
This uses `cf` because the original project did not have a Wrangler config.
The Cloudflare CLI configuration/API remains beta and must be validated on GitHub
CI before relying on its typed config shape. We have **not** executed a remote
Docker build or Cloudflare deployment in this session.
