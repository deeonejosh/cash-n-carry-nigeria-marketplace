import { spawn } from 'node:child_process';

const env = process.env;
function requireSetting(name) {
  if (!env[name]) throw new Error(`Missing staging setting: ${name}`);
  return env[name];
}

function parseSetting(name) {
  const value = requireSetting(name);
  try { return new URL(value); }
  catch { throw new Error(`Invalid staging URL: ${name}`); }
}

const site = parseSetting('NEXT_PUBLIC_APP_URL');
if (site.protocol !== 'https:' || /(^|\.)cashncarryng\.com$/i.test(site.hostname) || site.username || site.password || site.pathname !== '/' || site.search || site.hash) {
  throw new Error('Hosted staging requires a separate HTTPS origin');
}
const database = parseSetting('DATABASE_URL');
if (!['postgres:', 'postgresql:'].includes(database.protocol) || !/staging/i.test(database.pathname)) {
  throw new Error('Hosted staging requires a dedicated PostgreSQL database named for staging');
}
if (env.EVENTS_DATABASE_URL) {
  const events = parseSetting('EVENTS_DATABASE_URL');
  if (events.pathname !== database.pathname) throw new Error('Events connection must use the staging database');
}
if (env.PAYSTACK_SECRET_KEY && !env.PAYSTACK_SECRET_KEY.startsWith('sk_test_')) throw new Error('Paystack test key required');
if (env.FLUTTERWAVE_SECRET_KEY && !env.FLUTTERWAVE_SECRET_KEY.startsWith('FLWSECK_TEST-')) throw new Error('Flutterwave test key required');
if (!/^[a-f\d]{64}$/i.test(requireSetting('KYC_DOCUMENT_KEY'))) throw new Error('Invalid KYC document key');
if (requireSetting('JWT_SECRET').length < 32) throw new Error('Staging JWT secret must be at least 32 characters');
const commission = requireSetting('SELLER_COMMISSION_BPS');
if (!/^\d{1,5}$/.test(commission) || Number(commission) > 10000) throw new Error('Invalid staging commission rate');
requireSetting('KYC_S3_BUCKET');
if (!env.KYC_CLAMD_SOCKET && !env.KYC_CLAMD_HOST) throw new Error('Private ClamAV service required');

const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-H', '0.0.0.0'], {
  stdio: 'inherit', env: { ...env, KYC_STORAGE_REQUIRED: '1' },
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', (code) => { process.exitCode = code ?? 1; });
