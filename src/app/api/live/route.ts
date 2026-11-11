import { randomUUID } from 'node:crypto';
import { AccessToken, RoomServiceClient, TrackSource } from 'livekit-server-sdk';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/withAuth';
import { publicProductFilter } from '@/lib/catalog';

const action = z.discriminatedUnion('action', [
  z.object({ action: z.literal('start'), title: z.string().trim().min(3).max(120) }),
  z.object({ action: z.literal('join'), id: z.string().min(1), broadcast: z.boolean().default(false) }),
  z.object({ action: z.literal('end'), id: z.string().min(1) }),
  z.object({ action: z.literal('pin'), id: z.string().min(1), productId: z.string().min(1).nullable(), auctionId: z.string().min(1).nullable() }),
  z.object({ action: z.literal('remove'), id: z.string().min(1), identity: z.string().min(1).max(150) }),
]);

function config() {
  const { LIVEKIT_URL: url, LIVEKIT_API_KEY: key, LIVEKIT_API_SECRET: secret } = process.env;
  return url && key && secret && /^wss?:\/\//.test(url) ? { url, key, secret } : null;
}

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get('id');
  const streams = await prisma.liveStream.findMany({
    where: { ...(id ? { id } : {}), status: 'LIVE', seller: { status: 'VERIFIED' } },
    select: {
      id: true, title: true, seller: { select: { storefrontName: true } },
      pinnedProduct: { select: { id: true, slug: true, title: true, published: true } },
      pinnedAuction: { select: { id: true, title: true, endsAt: true, closedAt: true } },
    },
    orderBy: { startsAt: 'desc' }, take: 30,
  });
  return NextResponse.json({
    streams: streams.map((stream) => ({
      ...stream, pinnedProduct: stream.pinnedProduct?.published ? stream.pinnedProduct : null,
      pinnedAuction: stream.pinnedAuction && !stream.pinnedAuction.closedAt && stream.pinnedAuction.endsAt > new Date() ? stream.pinnedAuction : null,
    })),
  });
}

export async function POST(req: Request) {
  const auth = await withAuth(req);
  if (!auth.ok) return auth.response;
  const input = action.safeParse(await req.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: 'Invalid stream request' }, { status: 400 });
  const data = input.data;
  const provider = config();
  if (!provider) return NextResponse.json({ error: 'Livestream provider is not configured' }, { status: 503 });

  if (data.action === 'start') {
    if (auth.auth.role !== 'SELLER') return NextResponse.json({ error: 'Verified seller required' }, { status: 403 });
    const seller = await prisma.sellerProfile.findFirst({ where: { userId: auth.auth.sub, status: 'VERIFIED' } });
    if (!seller) return NextResponse.json({ error: 'Verified seller required' }, { status: 403 });
    const stream = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "SellerProfile" WHERE "id" = ${seller.id} FOR UPDATE`;
      const existing = await tx.liveStream.findFirst({ where: { sellerId: seller.id, status: 'LIVE' }, select: { id: true } });
      return existing ?? tx.liveStream.create({ data: { sellerId: seller.id, title: data.title, status: 'LIVE', startsAt: new Date() }, select: { id: true } });
    });
    return NextResponse.json({ id: stream.id }, { status: 201 });
  }

  const stream = await prisma.liveStream.findUnique({
    where: { id: data.id }, select: { id: true, status: true, sellerId: true, seller: { select: { userId: true, status: true } } },
  });
  if (!stream) return NextResponse.json({ error: 'Stream unavailable' }, { status: 404 });
  const owns = stream.seller.userId === auth.auth.sub && auth.auth.role === 'SELLER';
  const room = `cnc-${stream.id}`;
  if (data.action === 'join') {
    if (stream.status !== 'LIVE' || stream.seller.status !== 'VERIFIED') return NextResponse.json({ error: 'Stream unavailable' }, { status: 404 });
    if (data.broadcast && !owns) return NextResponse.json({ error: 'Broadcast access denied' }, { status: 403 });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: auth.auth.sub }, select: { name: true } });
    const token = new AccessToken(provider.key, provider.secret, {
      identity: data.broadcast ? `host-${auth.auth.sub}` : `viewer-${randomUUID()}`,
      name: user.name, ttl: '2m',
    });
    token.addGrant({
      room, roomJoin: true, canSubscribe: true, canPublishData: true, canPublish: data.broadcast,
      ...(data.broadcast ? { canPublishSources: [TrackSource.CAMERA, TrackSource.MICROPHONE] } : {}),
    });
    return NextResponse.json({ token: await token.toJwt(), url: provider.url, canModerate: owns || auth.auth.role === 'ADMIN' });
  }

  if (!owns && auth.auth.role !== 'ADMIN') return NextResponse.json({ error: 'Moderation access denied' }, { status: 403 });
  if (data.action === 'pin') {
    if (stream.status !== 'LIVE') return NextResponse.json({ error: 'Stream unavailable' }, { status: 409 });
    const [product, auction] = await Promise.all([
      data.productId ? prisma.product.findFirst({ where: { id: data.productId, sellerId: stream.sellerId, ...publicProductFilter }, select: { id: true } }) : null,
      data.auctionId ? prisma.auction.findFirst({ where: { id: data.auctionId, sellerId: stream.sellerId, closedAt: null, endsAt: { gt: new Date() } }, select: { id: true } }) : null,
    ]);
    if ((data.productId && !product) || (data.auctionId && !auction)) return NextResponse.json({ error: 'Pin must belong to this seller and be available' }, { status: 409 });
    await prisma.liveStream.updateMany({
      where: { id: stream.id, status: 'LIVE' }, data: { pinnedProductId: product?.id ?? null, pinnedAuctionId: auction?.id ?? null },
    });
    return NextResponse.json({ success: true });
  }

  const service = new RoomServiceClient(provider.url.replace(/^ws/, 'http'), provider.key, provider.secret);
  try {
    if (data.action === 'end') {
      await prisma.liveStream.updateMany({ where: { id: stream.id, status: 'LIVE' }, data: { status: 'ENDED' } });
      const rooms = await service.listRooms([room]);
      if (rooms.length) await service.deleteRoom(room);
    } else {
      if (!data.identity.startsWith('viewer-')) return NextResponse.json({ error: 'Select a viewer' }, { status: 400 });
      await service.removeParticipant(room, data.identity);
    }
  } catch {
    return NextResponse.json({ error: 'Provider moderation could not be confirmed. Retry this action.' }, { status: 502 });
  }
  return NextResponse.json({ success: true });
}
