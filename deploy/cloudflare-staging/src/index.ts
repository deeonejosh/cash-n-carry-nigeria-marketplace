import { DurableObject } from "cloudflare:workers";

const PORT = 3000;
const INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000;
const SECRET_KEYS = [
  "DATABASE_URL", "EVENTS_DATABASE_URL", "JWT_SECRET", "KYC_DOCUMENT_KEY",
  "KYC_S3_ENDPOINT", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "KYC_CLAMD_HOST"
] as const;

interface Env {
  STAGE_CONTAINER: DurableObjectNamespace<CashNCarryStage>;
  NEXT_PUBLIC_APP_URL: string;
  KYC_S3_BUCKET: string;
  KYC_S3_REGION: string;
  KYC_S3_PATH_STYLE: string;
  SELLER_COMMISSION_BPS: string;
  DATABASE_URL: string;
  EVENTS_DATABASE_URL: string;
  JWT_SECRET: string;
  KYC_DOCUMENT_KEY: string;
  KYC_S3_ENDPOINT: string;
  AWS_ACCESS_KEY_ID: string;
  AWS_SECRET_ACCESS_KEY: string;
  KYC_CLAMD_HOST: string;
}

export class CashNCarryStage extends DurableObject<Env> {
  private starting: Promise<void> | undefined;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    const c = ctx.container;
    if (c?.running) {
      void ctx.blockConcurrencyWhile(() => c.setInactivityTimeout(INACTIVITY_TIMEOUT_MS));
    }
  }

  async fetch(request: Request): Promise<Response> {
    this.starting ??= this.startAndWait().finally(() => { this.starting = undefined; });
    await this.starting;
    const target = new URL(request.url);
    target.protocol = "http:";
    target.host = "container";
    const forwarded = new Request(target.toString(), request);
    forwarded.headers.delete("host");
    return this.ctx.container!.getTcpPort(PORT).fetch(forwarded);
  }

  private async startAndWait(): Promise<void> {
    const c = this.ctx.container!;
    if (!c.running) {
      for (const key of SECRET_KEYS) {
        if (!this.env[key]) throw new Error(`Staging secret not configured: ${key}`);
      }
      // Hard-stop on accidental production configuration.
      const app = new URL(this.env.NEXT_PUBLIC_APP_URL);
      const db = new URL(this.env.DATABASE_URL);
      if (app.protocol !== 'https:' || /(^|\.)cashncarryng\.com$/i.test(app.hostname)) {
        throw new Error('Not an independent staging URL');
      }
      if (db.pathname !== '/cashncarry_staging') throw new Error('Not the approved Neon staging database');
      if (this.env.KYC_S3_BUCKET !== 'cashncarry-staging-private') throw new Error('Not the approved staging R2 bucket');
      c.start({
        image: c.images.base,
        instance: "standard-1",
        enableInternet: true, // Required for Neon PostgreSQL and private R2 API over TLS.
        env: {
          NEXT_PUBLIC_APP_URL: this.env.NEXT_PUBLIC_APP_URL,
          DATABASE_URL: this.env.DATABASE_URL,
          EVENTS_DATABASE_URL: this.env.EVENTS_DATABASE_URL,
          JWT_SECRET: this.env.JWT_SECRET,
          KYC_DOCUMENT_KEY: this.env.KYC_DOCUMENT_KEY,
          KYC_S3_BUCKET: this.env.KYC_S3_BUCKET,
          KYC_S3_REGION: this.env.KYC_S3_REGION,
          KYC_S3_ENDPOINT: this.env.KYC_S3_ENDPOINT,
          KYC_S3_PATH_STYLE: this.env.KYC_S3_PATH_STYLE,
          AWS_ACCESS_KEY_ID: this.env.AWS_ACCESS_KEY_ID,
          AWS_SECRET_ACCESS_KEY: this.env.AWS_SECRET_ACCESS_KEY,
          KYC_CLAMD_HOST: this.env.KYC_CLAMD_HOST,
          KYC_CLAMD_PORT: "3310",
          SELLER_COMMISSION_BPS: this.env.SELLER_COMMISSION_BPS,
          // No live payment credentials or seller transfer credentials in staging.
        }
      });
    }
    await c.setInactivityTimeout(INACTIVITY_TIMEOUT_MS);
    for (let attempt = 0; attempt < 120; attempt++) {
      try {
        const r = await c.getTcpPort(PORT).fetch('http://container/api/health', { signal: AbortSignal.timeout(1500) });
        await r.body?.cancel();
        if (r.ok) return;
      } catch { /* Container may still be booting. */ }
      await scheduler.wait(500);
    }
    throw new Error('Staging container never became healthy');
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.hostname === 'cashncarryng.com' || url.hostname === 'www.cashncarryng.com') {
      return new Response('Production origin refused', { status: 403 });
    }
    return env.STAGE_CONTAINER.getByName('cashncarry-staging-singleton').fetch(request);
  }
} satisfies ExportedHandler<Env>;
