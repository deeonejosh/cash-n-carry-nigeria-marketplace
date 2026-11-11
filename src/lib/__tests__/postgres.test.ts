import { POST as receipt } from '@/app/api/messages/receipts/route';
import { POST as carrierEvent } from '@/app/api/shipments/carrier/route';
import { POST as requestReturn, PATCH as reviewReturn } from '@/app/api/returns/route';
import { POST as payoutDraft } from '@/app/api/admin/payout-drafts/route';
import { POST as scheduleDeal } from '@/app/api/flash-deals/route';
import { PATCH as updateShipment } from '@/app/api/shipments/route';
import { POST as refundPayment } from '@/app/api/admin/refunds/route';
import { POST as liveAction } from '@/app/api/live/route';
import { PATCH as changeBuyer } from '@/app/api/admin/buyers/route';
import { POST as openDispute, PATCH as resolveDispute } from '@/app/api/disputes/route';
import { POST as uploadVideo, PATCH as reactToVideo } from '@/app/api/videos/route';
import { GET as videoMedia } from '@/app/api/videos/[id]/media/route';
import { POST as createAuction, PATCH as actOnAuction } from '@/app/api/auctions/route';
import { POST as coinOperation } from '@/app/api/coins/route';
import { POST as createProduct } from '@/app/api/products/route';
import { PATCH as editProduct } from '@/app/api/products/[slug]/route';
import { expireReservations } from '@/lib/reservations';
import { POST as saveAddress } from '@/app/api/addresses/route';
import { POST as saveWishlist } from '@/app/api/wishlist/route';
import { POST as uploadKyc, GET as downloadKyc } from '@/app/api/sellers/kyc/route';
import { PATCH as advanceOrder } from '@/app/api/orders/status/route';
import { createHmac, randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import { POST as register } from '@/app/api/auth/register/route';
import { POST as login } from '@/app/api/auth/login/route';
import { GET as session } from '@/app/api/auth/session/route';
import { GET as auditLogs } from '@/app/api/admin/audit-logs/route';
import { POST as updateCart } from '@/app/api/cart/route';
import { POST as createOrder } from '@/app/api/orders/route';
import { GET as search } from '@/app/api/products/search/route';
import { POST as verifyPayment } from '@/app/api/payments/verify/route';
import { POST as applyAsSeller } from '@/app/api/sellers/route';
import { PATCH as reviewSeller } from '@/app/api/admin/sellers/route';
import { POST as initialize } from '@/app/api/payments/initialize/route';
import { POST as paystackWebhook } from '@/app/api/payments/webhooks/paystack/route';
import { createSession } from '@/lib/auth';
import { GET as inbox, POST as sendMessage } from '@/app/api/messages/route';

const enabled = process.env.RUN_POSTGRES_TESTS === '1';

function request(path: string, body?: unknown, cookie?: string) {
  return new Request(`http://localhost${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe.skipIf(!enabled)('marketplace API on disposable PostgreSQL', () => {
  afterAll(async () => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    await prisma.$disconnect();
  });

  it('registers and signs in buyers, scopes messages, reserves stock and reconciles payments', async () => {
    const database = new URL(process.env.DATABASE_URL ?? '');
    expect(['localhost', '127.0.0.1', '[::1]']).toContain(database.hostname);
    expect(database.pathname).toMatch(/_test$/);

    const suffix = randomUUID();
    const credentials = { email: `buyer-${suffix}@example.test`, password: 'local-test-password' };
    const registered = await register(request('/api/auth/register', { ...credentials, name: 'Test buyer' }));
    expect(registered.status).toBe(201);
    const { user: buyer } = await registered.json();
    const signedIn = await login(request('/api/auth/login', credentials));
    expect(signedIn.status).toBe(200);
    const cookie = signedIn.headers.get('set-cookie')!.split(';')[0];
    const account = await session(request('/api/auth/session', undefined, cookie));
    const accountData = (await account.json()).user;
    expect(accountData).toMatchObject({ id: buyer.id, role: 'BUYER' });
    expect(accountData).not.toHaveProperty('passwordHash');
    expect((await auditLogs(request('/api/admin/audit-logs', undefined, cookie))).status).toBe(401);

    const seller = await prisma.sellerProfile.create({
      data: {
        businessName: 'Test store', storefrontName: 'Test store', status: 'VERIFIED',
        user: { create: { email: `seller-${suffix}@example.test`, name: 'Test seller', passwordHash: 'fixture', role: 'SELLER' } },
      },
    });
    const message = await sendMessage(request('/api/messages', { receiverId: seller.userId, text: 'Is this available?' }, cookie));
    expect(message.status).toBe(201);
    const { message: sentMessage } = await message.json();
    expect((await (await receipt(request('/api/messages/receipts', { ids: [sentMessage.id] }, cookie))).json()).delivered).toBe(0);
    const receiverSession = await createSession(await prisma.user.findUniqueOrThrow({ where: { id: seller.userId } }));
    const receiverCookie = `cnc_session=${receiverSession.token}`;
    expect((await (await receipt(request('/api/messages/receipts', { ids: [sentMessage.id] }, receiverCookie))).json()).delivered).toBe(1);
    expect((await (await receipt(request('/api/messages/receipts', { ids: [sentMessage.id] }, receiverCookie))).json()).delivered).toBe(0);
    const threads = await inbox(request('/api/messages', undefined, cookie));
    expect((await threads.json()).threads).toHaveLength(1);

    const product = await prisma.product.create({
      data: { sellerId: seller.id, title: 'API test product', slug: suffix, description: 'Local checkout fixture', price: '125.50', stock: 3, imageUrl: '', published: true },
    });
    const results = await search(request('/api/products/search?q=API+test+product'));
    expect((await results.json()).products).toEqual(expect.arrayContaining([expect.objectContaining({ id: product.id })]));
    expect((await updateCart(request('/api/cart', { productId: product.id, quantity: 2 }, cookie))).status).toBe(201);
    expect((await saveAddress(request('/api/addresses', { label: 'Home', address: 'Test shipping address' }, cookie))).status).toBe(201);
    expect((await saveWishlist(request('/api/wishlist', { productId: product.id }, cookie))).status).toBe(200);
    expect((await saveWishlist(request('/api/wishlist', { productId: product.id }, cookie))).status).toBe(200);
    expect(await prisma.wishlistItem.count({ where: { userId: buyer.id } })).toBe(1);

    const checkout = {
      checkoutKey: randomUUID(), shippingAddress: 'Test shipping address', items: [{ productId: product.id, quantity: 2 }],
    };
    const [created, retried] = await Promise.all([
      createOrder(request('/api/orders', checkout, cookie)),
      createOrder(request('/api/orders', checkout, cookie)),
    ]);
    expect(created.status).toBe(201);
    expect(retried.status).toBe(201);
    const { order } = await created.json();
    expect((await retried.json()).order.id).toBe(order.id);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock).toBe(1);
    expect((await createOrder(request('/api/orders', { ...checkout, checkoutKey: randomUUID() }, cookie))).status).toBe(409);

    const expired = await createOrder(request('/api/orders', {
      ...checkout, checkoutKey: randomUUID(), items: [{ productId: product.id, quantity: 1 }],
    }, cookie));
    expect(expired.status).toBe(201);
    const abandoned = (await expired.json()).order;
    await prisma.order.update({ where: { id: abandoned.id }, data: { reservationEnds: new Date(Date.now() - 1000) } });
    expect(await expireReservations()).toBe(1);
    expect(await expireReservations()).toBe(0);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock).toBe(1);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: abandoned.id } })).status).toBe('CANCELLED');

    vi.stubEnv('PAYSTACK_SECRET_KEY', 'sk_test_fixture');
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000');
    const provider = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: true, data: { authorization_url: 'https://checkout.paystack.com/fixture', access_code: 'fixture' } }),
    });
    vi.stubGlobal('fetch', provider);
    const initialized = await initialize(request('/api/payments/initialize', { orderId: order.id, provider: 'paystack' }, cookie));
    expect(initialized.status).toBe(200);
    const { reference } = await initialized.json();
    const reused = await initialize(request('/api/payments/initialize', { orderId: order.id, provider: 'paystack' }, cookie));
    expect((await reused.json()).reference).toBe(reference);
    expect(provider).toHaveBeenCalledOnce();
    provider.mockRejectedValueOnce(new Error('Gateway temporarily unavailable'));
    expect((await verifyPayment(request('/api/payments/verify', { reference }, cookie))).status).toBe(502);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('PENDING');
    provider.mockResolvedValue({
      ok: true,
      json: async () => ({ status: true, data: { status: 'success', reference, amount: 25100, currency: 'NGN' } }),
    });
    const body = JSON.stringify({ event: 'charge.success', data: { reference } });
    const signature = createHmac('sha512', 'sk_test_fixture').update(body).digest('hex');
    const webhook = () => new Request('http://localhost/api/payments/webhooks/paystack', {
      method: 'POST', body, headers: { 'x-paystack-signature': signature },
    });
    expect((await paystackWebhook(webhook())).status).toBe(200);
    expect((await paystackWebhook(webhook())).status).toBe(200);
    expect((await verifyPayment(request('/api/payments/verify', { reference }, cookie))).status).toBe(200);
    expect(provider).toHaveBeenCalledTimes(3);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('PAID');

    const application = await applyAsSeller(request('/api/sellers', {
      businessName: 'Applicant business', storefrontName: 'Applicant shop', location: 'Lagos',
    }, cookie));
    expect(application.status).toBe(201);
    const { seller: applicant } = await application.json();
    expect(applicant.status).toBe('PENDING');
    const admin = await prisma.user.create({
      data: { email: `admin-${suffix}@example.test`, name: 'Test administrator', passwordHash: 'fixture', role: 'ADMIN' },
    });
    const adminSession = await createSession(admin);
    const pdf = '%PDF-1.7 fixture';
    expect((await uploadKyc(new Request('http://localhost/api/sellers/kyc', {
      method: 'POST', headers: { 'content-type': 'application/pdf', cookie }, body: pdf,
    }))).status).toBe(200);
    const documentUrl = `http://localhost/api/sellers/kyc?sellerId=${applicant.id}`;
    expect((await downloadKyc(new Request(documentUrl, { headers: { cookie } }))).status).toBe(401);
    const adminCookie = `cnc_session=${adminSession.token}`;
    const download = await downloadKyc(new Request(documentUrl, { headers: { cookie: adminCookie } }));
    expect(download.status).toBe(200);
    expect(await download.text()).toBe(pdf);
    const advance = (roleCookie: string, status: string) => advanceOrder(new Request('http://localhost/api/orders/status', {
      method: 'PATCH', headers: { 'content-type': 'application/json', cookie: roleCookie },
      body: JSON.stringify({ orderId: order.id, status }),
    }));
    expect((await advance(cookie, 'PACKING')).status).toBe(401);
    expect((await advance(adminCookie, 'DELIVERED')).status).toBe(409);
    for (const status of ['PACKING', 'SHIPPED', 'DELIVERED']) {
      expect((await advance(adminCookie, status)).status).toBe(200);
    }
    expect(await prisma.notification.count({ where: { userId: buyer.id, type: 'order' } })).toBe(3);
    const submittedKyc = await prisma.sellerKyc.findUniqueOrThrow({ where: { sellerId: applicant.id } });
    const review = await reviewSeller(new Request('http://localhost/api/admin/sellers', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie: `cnc_session=${adminSession.token}` },
      body: JSON.stringify({ sellerId: applicant.id, status: 'APPROVED', reviewedSubmission: submittedKyc.submittedAt?.toISOString() }),
    }));
    expect(review.status).toBe(200);
    expect(await prisma.sellerKyc.findUnique({ where: { userId: buyer.id } })).toMatchObject({ status: 'APPROVED' });
    expect((await session(request('/api/auth/session', undefined, cookie))).status).toBe(200);
    expect(await prisma.user.findUnique({ where: { id: buyer.id } })).toMatchObject({ role: 'SELLER' });
    const draft = await createProduct(request('/api/products', {
      title: `Seller listing ${suffix}`, description: 'Test listing for publication', price: 25, stock: 10,
    }, cookie));
    expect(draft.status).toBe(201);
    const listing = (await draft.json()).product;
    const update = (roleCookie: string, changes: unknown) => editProduct(new Request('http://localhost/api/products/' + listing.slug, {
      method: 'PATCH', headers: { 'content-type': 'application/json', cookie: roleCookie }, body: JSON.stringify(changes),
    }), { params: Promise.resolve({ slug: listing.slug }) });
    expect((await update(cookie, { stock: 12, expectedStock: 9 })).status).toBe(409);
    expect((await update(cookie, { stock: 12, expectedStock: 10 })).status).toBe(200);
    expect((await update(cookie, { published: true })).status).toBe(403);
    expect((await update(adminCookie, { published: true })).status).toBe(200);
    expect(await prisma.product.findUnique({ where: { id: listing.id } })).toMatchObject({ published: true, stock: 12 });


    const auctionResponse = await createAuction(request('/api/auctions', {
      productId: listing.id, startingBidKobo: 10000, durationMinutes: 5,
    }, cookie));
    expect(auctionResponse.status).toBe(201);
    const auction = (await auctionResponse.json()).auction;
    const bidder = await prisma.user.create({
      data: { email: `bidder-${suffix}@example.test`, name: 'Bidder', passwordHash: 'fixture', role: 'BUYER' },
    });
    const bidderCookie = `cnc_session=${(await createSession(bidder)).token}`;
    const compete = (roleCookie: string, actionData: unknown) => actOnAuction(new Request('http://localhost/api/auctions', {
      method: 'PATCH', headers: { 'content-type': 'application/json', cookie: roleCookie },
      body: JSON.stringify(actionData),
    }));
    const bid = { action: 'bid', id: auction.id, amountKobo: 12500 };
    const bidResults = await Promise.all([compete(bidderCookie, bid), compete(bidderCookie, bid)]);
    expect(bidResults.map((response) => response.status).sort()).toEqual([200, 409]);
    expect(await prisma.bid.count({ where: { auctionId: auction.id } })).toBe(1);
    await prisma.auction.update({ where: { id: auction.id }, data: { endsAt: new Date(Date.now() - 1000) } });
    const claim = { action: 'checkout', id: auction.id, shippingAddress: 'Winner shipping address' };
    const [winner, duplicate] = await Promise.all([compete(bidderCookie, claim), compete(bidderCookie, claim)]);
    expect(winner.status).toBe(200);
    const winningOrderId = (await winner.json()).orderId;
    expect((await duplicate.json()).orderId).toBe(winningOrderId);
    expect(await prisma.order.findUnique({ where: { id: winningOrderId } })).toMatchObject({ userId: bidder.id, status: 'PENDING' });
    expect((await prisma.product.findUniqueOrThrow({ where: { id: listing.id } })).stock).toBe(11);

    const credit = { action: 'credit', recipientId: bidder.id, coins: 1000, requestId: randomUUID() };
    const coins = (data: unknown, roleCookie: string) => coinOperation(request('/api/coins', data, roleCookie));
    expect((await coins(credit, bidderCookie)).status).toBe(403);
    expect((await coins(credit, adminCookie)).status).toBe(200);
    expect((await coins(credit, adminCookie)).status).toBe(200);
    const gift = { action: 'gift', recipientId: buyer.id, gift: 'lion', requestId: randomUUID() };
    const gifts = await Promise.all([coins(gift, bidderCookie), coins({ ...gift, requestId: randomUUID() }, bidderCookie)]);
    expect(gifts.map((response) => response.status).sort()).toEqual([200, 409]);
    expect(await prisma.gift.count({ where: { senderId: bidder.id } })).toBe(1);
    expect((await prisma.coinLedger.aggregate({ where: { userId: bidder.id }, _sum: { delta: true } }))._sum.delta).toBe(0);
    expect((await prisma.coinLedger.aggregate({ where: { userId: buyer.id }, _sum: { delta: true } }))._sum.delta).toBe(1000);

    const dispute = await openDispute(request('/api/disputes', {
      orderId: order.id, reason: 'ITEM', description: 'Fixture buyer reported an item issue.',
    }, cookie));
    expect(dispute.status).toBe(201);
    const { dispute: opened } = await dispute.json();
    const resolution = await resolveDispute(new Request('http://localhost/api/disputes', {
      method: 'PATCH', headers: { 'content-type': 'application/json', cookie: adminCookie },
      body: JSON.stringify({ id: opened.id, resolution: 'Resolved through manual review.' }),
    }));
    expect(resolution.status).toBe(200);

    const video = Buffer.from('0000ftypisom0000');
    const posted = await uploadVideo(new Request(`http://localhost/api/videos?title=Fixture&productId=${listing.id}`, {
      method: 'POST', headers: { 'content-type': 'video/mp4', cookie }, body: video,
    }));
    expect(posted.status).toBe(201);
    const { id: videoId } = await posted.json();
    const range = await videoMedia(new Request('http://localhost/media', { headers: { range: 'bytes=4-7' } }), { params: Promise.resolve({ id: videoId }) });
    expect(range.status).toBe(206);
    expect(await range.text()).toBe('ftyp');
    const react = (action: string, roleCookie: string, text?: string) => reactToVideo(new Request('http://localhost/api/videos', {
      method: 'PATCH', headers: { 'content-type': 'application/json', cookie: roleCookie },
      body: JSON.stringify({ id: videoId, action, text }),
    }));
    expect((await react('like', bidderCookie)).status).toBe(200);
    expect((await react('like', bidderCookie)).status).toBe(200);
    expect((await react('comment', bidderCookie, 'Nice product.')).status).toBe(200);
    expect((await react('follow', bidderCookie)).status).toBe(200);
    expect(await prisma.videoPost.findUnique({ where: { id: videoId }, select: { likes: true, commentsCount: true } }))
      .toEqual({ likes: 1, commentsCount: 1 });
    expect((await react('hide', adminCookie)).status).toBe(200);
    expect((await videoMedia(new Request('http://localhost/media'), { params: Promise.resolve({ id: videoId }) })).status).toBe(404);
    const rejected = Array.from({ length: 9 }, () => login(request('/api/auth/login', {
      email: `missing-${suffix}@example.test`, password: 'wrong-password',
    })));
    const statuses = (await Promise.all(rejected)).map((response) => response.status);
    expect(statuses.filter((status) => status === 429)).toHaveLength(1);

    await prisma.order.update({ where: { id: winningOrderId }, data: { status: 'PAID' } });
    const progress = (status: string) => advanceOrder(new Request('http://localhost/api/orders/status', {
      method: 'PATCH', headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ orderId: winningOrderId, status }),
    }));
    expect((await progress('PACKING')).status).toBe(200);
    expect((await progress('SHIPPED')).status).toBe(200);
    expect((await progress('DELIVERED')).status).toBe(403);

    const start = Date.now() + 60_000;
    expect((await scheduleDeal(request('/api/flash-deals', {
      productId: listing.id, priceKobo: 1500, stock: 1, startsAt: new Date(start).toISOString(),
      endsAt: new Date(start + 60_000).toISOString(),
    }, cookie))).status).toBe(201);
    await prisma.product.update({
      where: { id: listing.id }, data: { dealStartsAt: new Date(Date.now() - 1000) },
    });
    const split = await createOrder(request('/api/orders', {
      checkoutKey: randomUUID(), shippingAddress: 'Split order shipping address',
      items: [{ productId: listing.id, quantity: 1 }, { productId: product.id, quantity: 1 }],
    }, bidderCookie));
    expect(split.status).toBe(201);
    const splitOrderId = (await split.json()).order.id;
    expect(await prisma.orderShipment.count({ where: { orderId: splitOrderId } })).toBe(2);
    const discounted = await prisma.orderItem.findFirstOrThrow({ where: { orderId: splitOrderId, productId: listing.id } });
    expect(discounted.price.toNumber()).toBe(15);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: listing.id } })).dealRemaining).toBe(0);
    const splitShipments = await prisma.orderShipment.findMany({ where: { orderId: splitOrderId } });
    const ownedShipment = splitShipments.find((item) => item.sellerId === listing.sellerId)!;
    const otherShipment = splitShipments.find((item) => item.id !== ownedShipment.id)!;
    await prisma.order.update({ where: { id: splitOrderId }, data: { status: 'PAID' } });
    const move = (shipmentId: string, status: string, roleCookie: string, tracking?: object) => updateShipment(
      new Request('http://localhost/api/shipments', {
        method: 'PATCH', headers: { 'content-type': 'application/json', cookie: roleCookie },
        body: JSON.stringify({ id: shipmentId, status, ...tracking }),
      }),
    );
    expect((await move(otherShipment.id, 'PACKING', cookie)).status).toBe(409);
    expect((await move(ownedShipment.id, 'PACKING', cookie)).status).toBe(200);
    expect((await move(ownedShipment.id, 'SHIPPED', cookie)).status).toBe(400);
    expect((await move(ownedShipment.id, 'SHIPPED', cookie, { carrier: 'Fixture Carrier', trackingRef: 'CNC123' })).status).toBe(200);
    expect(await prisma.order.findUnique({ where: { id: splitOrderId } })).toMatchObject({ status: 'PAID' });
    expect((await move(otherShipment.id, 'PACKING', adminCookie)).status).toBe(200);
    expect(await prisma.order.findUnique({ where: { id: splitOrderId } })).toMatchObject({ status: 'PACKING' });

    const carrierKey = 'fixture-carrier-secret-with-enough-characters';
    vi.stubEnv('CARRIER_WEBHOOK_SECRET', carrierKey);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const tracking = JSON.stringify({
      shipmentId: ownedShipment.id, carrier: 'Fixture Carrier', trackingRef: 'CNC123', eventId: 'carrier-event-1',
      status: 'IN_TRANSIT', occurredAt: new Date().toISOString(),
    });
    const signedTracking = (signature: string) => carrierEvent(new Request('http://localhost/api/shipments/carrier', {
      method: 'POST', body: tracking, headers: { 'x-cnc-timestamp': timestamp, 'x-cnc-signature': signature },
    }));
    expect((await signedTracking('0'.repeat(64))).status).toBe(401);
    const trackingSignature = createHmac('sha256', carrierKey).update(timestamp + '.' + tracking).digest('hex');
    expect((await (await signedTracking(trackingSignature)).json()).newEvent).toBe(true);
    expect((await (await signedTracking(trackingSignature)).json()).newEvent).toBe(false);

    const returnInput = { itemId: discounted.id, quantity: 1, reason: 'Fixture item damaged', requestId: randomUUID() };
    expect((await requestReturn(request('/api/returns', returnInput, cookie))).status).toBe(409);
    const openedReturn = await requestReturn(request('/api/returns', returnInput, bidderCookie));
    expect(openedReturn.status).toBe(201);
    const { returnRequest: itemReturn } = await openedReturn.json();
    expect((await requestReturn(request('/api/returns', { ...returnInput, requestId: randomUUID() }, bidderCookie))).status).toBe(409);
    for (const status of ['APPROVED', 'RECEIVED']) {
      expect((await reviewReturn(new Request('http://localhost/api/returns', {
        method: 'PATCH', headers: { 'content-type': 'application/json', cookie: adminCookie },
        body: JSON.stringify({ id: itemReturn.id, status }),
      }))).status).toBe(200);
    }
    const splitPaid = await prisma.payment.create({
      data: { userId: bidder.id, orderId: splitOrderId, provider: 'PAYSTACK', providerRef: `split-${suffix}`,
        status: 'SUCCESS', amount: '140.50', currency: 'NGN' },
    });
    const returnRefund = { action: 'create', paymentId: splitPaid.id, returnId: itemReturn.id, requestId: randomUUID(), amountKobo: 1500, reason: 'Approved item return' };
    expect((await refundPayment(request('/api/admin/refunds', { ...returnRefund, amountKobo: 1501 }, adminCookie))).status).toBe(409);
    provider.mockResolvedValueOnce({
      ok: true, json: async () => ({ status: true, data: { id: 5544, status: 'processed', amount: 1500, currency: 'NGN' } }),
    });
    expect((await refundPayment(request('/api/admin/refunds', returnRefund, adminCookie))).status).toBe(200);
    expect(await prisma.returnRequest.findUnique({ where: { id: itemReturn.id } })).toMatchObject({ status: 'REFUNDED' });
    expect(await prisma.payment.findUnique({ where: { id: splitPaid.id } })).toMatchObject({ status: 'SUCCESS' });

    const paid = await prisma.payment.findFirstOrThrow({ where: { orderId: order.id, status: 'SUCCESS' } });
    const allocations = await prisma.sellerSettlement.findMany({ where: { paymentId: paid.id } });
    expect(allocations).toHaveLength(1);
    expect(allocations[0].gross.toNumber()).toBe(251);
    vi.stubEnv('SELLER_COMMISSION_BPS', '250');
    const payoutRecord = await payoutDraft(request('/api/admin/payout-drafts', { settlementId: allocations[0].id }, adminCookie));
    expect(payoutRecord.status).toBe(200);
    const { payoutDraft: recordedDraft } = await payoutRecord.json();
    expect(recordedDraft).toMatchObject({ commissionBps: 250, commissionAmount: '6.28', amount: '244.72' });
    const refund = (input: object, roleCookie = adminCookie) => refundPayment(request('/api/admin/refunds', input, roleCookie));
    const refundInput = { action: 'create', paymentId: paid.id, requestId: randomUUID(), amountKobo: 25100, reason: 'Fixture full refund' };
    expect((await refund(refundInput, bidderCookie)).status).toBe(401);
    expect((await refund({ ...refundInput, amountKobo: 25101 })).status).toBe(409);
    provider.mockResolvedValueOnce({
      ok: true, json: async () => ({ status: true, data: { id: 9876, status: 'pending', amount: 25100, currency: 'NGN' } }),
    });
    const submitted = await refund(refundInput);
    expect(submitted.status).toBe(200);
    const refundRecord = (await submitted.json()).refund;
    expect(refundRecord.status).toBe('PROCESSING');
    expect(await prisma.payoutDraft.findUnique({ where: { settlementId: allocations[0].id } })).toMatchObject({ status: 'STALE' });
    expect((await refund(refundInput)).status).toBe(200);
    expect((await refund({ ...refundInput, requestId: randomUUID() })).status).toBe(409);
    provider.mockResolvedValueOnce({
      ok: true, json: async () => ({ status: true, data: { id: 9876, status: 'processed', amount: 25100, currency: 'NGN' } }),
    });
    expect((await refund({ action: 'refresh', refundId: refundRecord.id })).status).toBe(200);
    expect(await prisma.order.findUnique({ where: { id: order.id } })).toMatchObject({ status: 'REFUNDED' });

    expect((await paystackWebhook(webhook())).status).toBe(200);
    const uncertainPayment = await prisma.payment.create({
      data: {
        userId: bidder.id, orderId: splitOrderId, provider: 'PAYSTACK', providerRef: `uncertain-${suffix}`,
        status: 'SUCCESS', amount: 10, currency: 'NGN',
      },
    });
    const uncertain = { ...refundInput, paymentId: uncertainPayment.id, amountKobo: 1000, requestId: randomUUID() };
    provider.mockRejectedValueOnce(new Error('Gateway disconnected'));
    expect((await refund(uncertain)).status).toBe(502);
    const unknown = await prisma.refund.findUniqueOrThrow({ where: { requestKey: uncertain.requestId } });
    expect(unknown.status).toBe('UNKNOWN');
    expect((await refund({ ...uncertain, requestId: randomUUID() })).status).toBe(409);

    vi.stubEnv('LIVEKIT_URL', '');
    expect((await liveAction(request('/api/live', { action: 'start', title: 'Fixture stream' }, cookie))).status).toBe(503);
    vi.stubEnv('LIVEKIT_URL', 'wss://live.example.test');
    vi.stubEnv('LIVEKIT_API_KEY', 'fixture-key');
    vi.stubEnv('LIVEKIT_API_SECRET', 'local-fixture-secret-with-enough-characters');
    expect((await liveAction(request('/api/live', { action: 'start', title: 'Fixture stream' }, bidderCookie))).status).toBe(403);
    const started = await liveAction(request('/api/live', { action: 'start', title: 'Fixture stream' }, cookie));
    expect(started.status).toBe(201);
    const streamId = (await started.json()).id;
    expect((await liveAction(request('/api/live', { action: 'join', id: streamId, broadcast: true }, bidderCookie))).status).toBe(403);
    const joined = await liveAction(request('/api/live', { action: 'join', id: streamId }, bidderCookie));
    const jwt = (await joined.json()).token.split('.')[1];
    expect(JSON.parse(Buffer.from(jwt, 'base64url').toString()).video).toMatchObject({ canPublish: false, canSubscribe: true });
    const changeActive = (active: boolean) => changeBuyer(new Request('http://localhost/api/admin/buyers', {
      method: 'PATCH', headers: { 'content-type': 'application/json', cookie: adminCookie },
      body: JSON.stringify({ id: bidder.id, active }),
    }));
    expect((await changeActive(false)).status).toBe(200);
    expect((await session(request('/api/auth/session', undefined, bidderCookie))).status).toBe(401);
    expect((await changeActive(true)).status).toBe(200);
    expect((await session(request('/api/auth/session', undefined, bidderCookie))).status).toBe(401);
  }, 15000);
});
