import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { chromium } from 'playwright-core';

const baseURL = new URL(process.env.BROWSER_BASE_URL ?? 'http://localhost:3109');
const database = new URL(process.env.DATABASE_URL ?? '');
const localHosts = ['localhost', '127.0.0.1', '[::1]'];
assert.ok(localHosts.includes(baseURL.hostname) && localHosts.includes(database.hostname) && /_test$/.test(database.pathname));

const prisma = new PrismaClient();
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium',
  args: [
    ...(process.env.CHROMIUM_NO_SANDBOX === '1' ? ['--no-sandbox', '--single-process', '--disable-gpu'] : []),
    ...(process.env.BROWSER_CERT_SPKI ? [`--ignore-certificate-errors-spki-list=${process.env.BROWSER_CERT_SPKI}`] : []),
  ],
});
const password = 'local-browser-fixture-password';
const suffix = randomUUID();
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const buyer = await context.newPage();
  await buyer.goto(new URL('/profile', baseURL).href);
  await buyer.getByRole('button', { name: 'Create a buyer account' }).click();
  await buyer.getByLabel('Name', { exact: true }).fill('Browser Buyer');
  await buyer.getByLabel('Email').fill(`browser-buyer-${suffix}@example.test`);
  await buyer.getByLabel('Password').fill(password);
  await buyer.getByRole('button', { name: 'Create account', exact: true }).click();
  await buyer.getByRole('heading', { name: 'Browser Buyer' }).waitFor();
  await buyer.getByRole('link', { name: 'Addresses', exact: true }).click();
  await buyer.getByLabel('Address label').fill('Home');
  await buyer.getByLabel('Shipping address').fill('10 Browser Test Street');
  await buyer.getByRole('button', { name: 'Save address' }).click();
  await buyer.getByRole('heading', { name: 'Home', exact: true }).waitFor();

  await buyer.goto(new URL('/shop?q=Gaming', baseURL).href);
  await buyer.getByRole('link', { name: 'Gaming Headset with Microphone', exact: true }).click();
  await buyer.getByRole('button', { name: 'Save to wishlist' }).click();
  await buyer.getByText('Saved to wishlist.').waitFor();
  await buyer.getByRole('button', { name: 'Add to cart', exact: true }).click();
  await buyer.getByText('Added to cart.').waitFor();
  await buyer.getByRole('link', { name: 'View cart', exact: true }).click();
  await buyer.getByLabel('Saved address').selectOption({ label: 'Home' });
  await buyer.getByRole('button', { name: 'Proceed to test checkout' }).click();
  await buyer.getByRole('alert').getByText('This test payment provider is not configured').waitFor();
  await buyer.goto(new URL('/orders', baseURL).href);
  await buyer.getByText('Gaming Headset with Microphone', { exact: false }).waitFor();

  await buyer.goto(new URL('/seller/register', baseURL).href);
  await buyer.getByLabel('Business name').fill('Browser Seller Ltd');
  await buyer.getByLabel('Storefront name').fill('Browser Store');
  await buyer.getByLabel('Location').fill('Lagos');
  await buyer.getByRole('button', { name: 'Save store details' }).click();
  await buyer.getByText('Store details saved.').waitFor();
  await buyer.getByRole('link', { name: 'Upload verification document' }).click();
  await buyer.locator('input[type=file]').setInputFiles({
    name: 'fixture.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7 browser fixture'),
  });
  await buyer.getByRole('button', { name: 'Upload document' }).click();
  await buyer.getByText('Document submitted for review.').waitFor();
  const sellerAccount = await prisma.user.findUniqueOrThrow({
    where: { email: `browser-buyer-${suffix}@example.test` },
    select: { sellerKyc: { select: { sellerId: true, documentData: true, documentObjectKey: true } } },
  });
  if (process.env.KYC_S3_BUCKET) {
    assert.equal(sellerAccount.sellerKyc.documentData, null);
    assert.match(sellerAccount.sellerKyc.documentObjectKey, /^kyc\/[a-f0-9-]{36}$/);
  } else if (process.env.KYC_DOCUMENT_KEY) {
    assert.equal(Buffer.from(sellerAccount.sellerKyc.documentData).subarray(0, 8).toString(), 'CNCKYC01');
  }
  const documentPath = `/api/sellers/kyc?sellerId=${sellerAccount.sellerKyc.sellerId}`;
  assert.equal(await buyer.evaluate(async (path) => (await fetch(path)).status, documentPath), 401);


  const adminEmail = `browser-admin-${suffix}@example.test`;
  await prisma.user.create({ data: { email: adminEmail, name: 'Browser Admin', role: 'ADMIN', passwordHash: await bcrypt.hash(password, 12) } });
  const buyerCookies = await context.cookies();
  await context.clearCookies();
  const admin = await context.newPage();
  await admin.setViewportSize({ width: 1280, height: 800 });
  await admin.goto(new URL('/profile', baseURL).href);
  await admin.getByLabel('Email').fill(adminEmail);
  await admin.getByLabel('Password').fill(password);
  await admin.getByRole('button', { name: 'Sign in', exact: true }).click();
  await admin.getByRole('heading', { name: 'Browser Admin' }).waitFor();
  await admin.goto(new URL('/admin', baseURL).href);
  const application = admin.locator('li').filter({ hasText: 'Browser Store' });
  const reviewLink = await application.getByRole('link', { name: 'Download submitted PDF' }).getAttribute('href');
  const verifiedDocument = await admin.evaluate(async (path) => {
    const response = await fetch(path);
    return { status: response.status, cache: response.headers.get('cache-control'), body: await response.text() };
  }, reviewLink);
  assert.deepEqual(verifiedDocument, { status: 200, cache: 'private, no-store', body: '%PDF-1.7 browser fixture' });
  await application.getByRole('button', { name: 'Approve' }).click();
  await application.waitFor({ state: 'hidden' });
  const adminCookies = await context.cookies();
  await context.clearCookies();
  await context.addCookies(buyerCookies);
  await buyer.goto(new URL('/seller/dashboard', baseURL).href);
  await buyer.getByRole('heading', { name: 'Browser Store' }).waitFor();
  await buyer.getByText('APPROVED', { exact: true }).waitFor();
  assert.deepEqual(await buyer.locator('nav').last().getByRole('link').allTextContents(), ['For You', 'Shop', '+', 'Messages', 'Profile']);
  await buyer.getByRole('link', { name: 'Manage products' }).click();
  await buyer.getByLabel('Title').fill(`Browser listing ${suffix}`);
  await buyer.getByLabel('Description').fill('Browser listing for product moderation');
  await buyer.getByLabel('Price (₦)').fill('1500');
  await buyer.getByLabel('Available stock').fill('5');
  await buyer.getByRole('button', { name: 'Create draft' }).click();
  await buyer.getByText('Draft created. It awaits admin publication.').waitFor();
  await context.clearCookies();
  await context.addCookies(adminCookies);
  await admin.goto(new URL('/admin/products', baseURL).href);
  const listing = admin.locator('article').filter({ hasText: `Browser listing ${suffix}` });
  await listing.getByRole('button', { name: 'Publish', exact: true }).click();
  await listing.getByRole('button', { name: 'Unpublish', exact: true }).waitFor();
  if (process.env.BROWSER_VIDEO_FIXTURE) {
    await context.clearCookies();
    await context.addCookies(buyerCookies);
    await buyer.goto(new URL('/videos/upload', baseURL).href);
    await buyer.getByLabel('Title', { exact: true }).fill('Browser shoppable clip');
    await buyer.locator('input[type=file]').setInputFiles(process.env.BROWSER_VIDEO_FIXTURE);
    await buyer.getByLabel('Tag a product').selectOption({ label: `Browser listing ${suffix}` });
    await buyer.getByRole('button', { name: 'Publish video' }).click();
    await buyer.getByRole('link', { name: 'Watch your video' }).click();
    const post = buyer.locator('article').filter({ hasText: 'Browser shoppable clip' });
    await post.getByRole('link', { name: `Shop Browser listing ${suffix}` }).waitFor();
    await buyer.waitForFunction(() => Array.from(document.querySelectorAll('video')).some((video) => video.readyState >= 1));
    await post.getByRole('button', { name: 'Like · 0' }).click();
    await post.getByRole('button', { name: 'Liked · 1' }).waitFor();
  }
  await context.clearCookies();
  await context.addCookies(adminCookies);
  const managedEmail = `browser-managed-${suffix}@example.test`;
  await prisma.user.create({ data: { email: managedEmail, name: 'Managed Buyer', role: 'BUYER', passwordHash: 'fixture' } });
  await admin.goto(new URL(`/admin/buyers?q=${encodeURIComponent(managedEmail)}`, baseURL).href);
  const managed = admin.locator('article').filter({ hasText: managedEmail });
  await managed.getByRole('button', { name: 'Suspend buyer' }).click();
  await managed.getByRole('button', { name: 'Reactivate buyer' }).waitFor();
  await context.clearCookies();
  await context.addCookies(buyerCookies);
  const eventConnection = buyer.waitForResponse((response) => response.url().endsWith('/api/events') && response.status() === 200);
  await buyer.goto(new URL('/notifications', baseURL).href);
  await eventConnection;
  const recipient = await prisma.user.findUniqueOrThrow({ where: { email: `browser-buyer-${suffix}@example.test` } });
  const pushed = `Browser push ${suffix}`;
  await prisma.notification.create({ data: { userId: recipient.id, title: pushed, body: 'PostgreSQL push fixture' } });
  await buyer.getByRole('heading', { name: pushed }).waitFor({ timeout: 8000 });
  const messageConnection = buyer.waitForResponse((response) => response.url().endsWith('/api/events') && response.status() === 200);
  await buyer.goto(new URL('/messages', baseURL).href);
  await messageConnection;
  const sender = await prisma.user.findUniqueOrThrow({ where: { email: adminEmail } });
  const thread = await prisma.messageThread.create({
    data: { title: 'Push fixture', participants: `${sender.id}:${recipient.id}`, lastMessageAt: new Date() },
  });
  const message = `Pushed message ${suffix}`;
  await prisma.message.create({ data: { threadId: thread.id, senderId: sender.id, receiverId: recipient.id, text: message } });
  await buyer.getByText(message, { exact: true }).waitFor({ timeout: 8000 });
  await buyer.waitForFunction(async (id) => {
    const data = await (await fetch('/api/messages')).json();
    return data.threads.some((item) => item.id === id && item.messages.some((entry) => entry.deliveredAt));
  }, thread.id, { timeout: 8000 });
  console.log('Chromium confirmed recipient delivery acknowledgement.');
  await buyer.goto(new URL('/live', baseURL).href);
  await buyer.getByLabel('Stream title').fill('Browser livestream fixture');
  await buyer.getByRole('button', { name: 'Start livestream' }).click();
  await buyer.getByRole('alert').getByText('Livestream provider is not configured').waitFor();
  console.log('Chromium passed database-backed notification and message push and missing livestream configuration.');
  console.log('Chromium passed buyer checkout recovery, mobile navigation, seller upload, admin approval, product moderation and buyer suspension.');
  if (process.env.BROWSER_VIDEO_FIXTURE) console.log('Chromium passed MP4 upload, metadata loading, product tagging and liking.');
} finally {
  await browser.close();
  await prisma.$disconnect();
}
