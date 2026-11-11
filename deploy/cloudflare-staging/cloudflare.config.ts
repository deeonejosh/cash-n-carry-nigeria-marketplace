import { bindings, defineConfig, defineContainer, exports } from "cf/config";
import * as entrypoint from "./src/index.ts" with { type: "cf-worker" };

// Staging-only resources; do not reuse a production Worker or Container.
const app = defineContainer({
  name: "cashncarry-staging-app",
  image: { dockerfile: "./build-context/Dockerfile" },
  instanceType: "standard-1",
  maxInstances: 1,
});

export default defineConfig({
  accountId: "508a24cccf3f5f764015a27fa1bb0f15",
  worker: {
    name: "cashncarry-staging-worker",
    entrypoint,
    compatibilityDate: "2026-11-11",
    compatibilityFlags: ["nodejs_compat"],
    exports: { CashNCarryStage: exports.durableObject({ storage: "sqlite", container: app }) },
    env: {
      STAGE_CONTAINER: bindings.durableObject({ worker: "cashncarry-staging-worker", exportName: "CashNCarryStage" }),
      NEXT_PUBLIC_APP_URL: bindings.text("https://cashncarry-staging-worker.cashncarry-workforce-2026.workers.dev"),
      KYC_S3_BUCKET: bindings.text("cashncarry-staging-private"),
      KYC_S3_REGION: bindings.text("auto"),
      KYC_S3_PATH_STYLE: bindings.text("0"),
      SELLER_COMMISSION_BPS: bindings.text("0"),
      // Provision these Worker secrets under the NEW staging Worker before release.
      DATABASE_URL: bindings.secret(),
      EVENTS_DATABASE_URL: bindings.secret(),
      JWT_SECRET: bindings.secret(),
      KYC_DOCUMENT_KEY: bindings.secret(),
      KYC_S3_ENDPOINT: bindings.secret(),
      AWS_ACCESS_KEY_ID: bindings.secret(),
      AWS_SECRET_ACCESS_KEY: bindings.secret(),
      KYC_CLAMD_HOST: bindings.secret(),
    },
  },
  containers: [app],
});
