import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/withAuth';
import { publicProductFilter } from '@/lib/catalog';

const maxVideo = 20 * 1024 * 1024;
const action = z.discriminatedUnion('action', [
  z.object({ action: z.literal('like'), id: z.string().min(1) }),
  z.object({ action: z.literal('comment'), id: z.string().min(1), text: z.string().trim().min(1).max(500) }),
  z.object({ action: z.literal('follow'), id: z.string().min(1) }),
  z.object({ action: z.literal('hide'), id: z.string().min(1) }),
]);

export async function GET(req: Request) {
  const auth = await withAuth(req);
  const userId = auth.ok ? auth.auth.sub : '';
  const posts = await prisma.videoPost.findMany({
    where: { visibility: 'PUBLIC', videoUrl: { startsWith: '/api/videos/' } },
    orderBy: { createdAt: 'desc' }, take: 20,
    select: {
      id: true, title: true, videoUrl: true, likes: true, commentsCount: true,
      creator: {
        select: { id: true, name: true, followers: { where: { followerId: userId }, select: { id: true } } },
      },
      product: { select: { title: true, slug: true, published: true, seller: { select: { status: true } } } },
      likesBy: { where: { userId }, select: { id: true } },
      comments: {
        orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, text: true, user: { select: { name: true } } },
      },
    },
  });
  return NextResponse.json({
    signedIn: !!userId,
    posts: posts.map(({ creator, product, likesBy, ...post }) => ({
      ...post, creator: creator.name, own: creator.id === userId, followed: !!creator.followers.length,
      liked: !!likesBy.length, product: product?.published && product.seller.status === 'VERIFIED'
        ? { title: product.title, slug: product.slug } : null,
    })),
  });
}

export async function POST(req: Request) {
  const auth = await withAuth(req, ['BUYER', 'SELLER']);
  if (!auth.ok) return auth.response;
  const url = new URL(req.url);
  const title = url.searchParams.get('title')?.trim() ?? '';
  const productId = url.searchParams.get('productId');
  if (!title || title.length > 120 || req.headers.get('content-type') !== 'video/mp4') {
    return NextResponse.json({ error: 'A title and MP4 video are required' }, { status: 400 });
  }
  const product = productId ? await prisma.product.findFirst({ where: { id: productId, ...publicProductFilter }, select: { id: true } }) : null;
  if (productId && !product) return NextResponse.json({ error: 'Tagged product unavailable' }, { status: 404 });

  const reader = req.body?.getReader();
  if (!reader) return NextResponse.json({ error: 'Video required' }, { status: 400 });
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.length;
      if (bytes > maxVideo) {
        await reader.cancel();
        return NextResponse.json({ error: 'Video exceeds 20 MB' }, { status: 413 });
      }
      chunks.push(value);
    }
  } catch {
    return NextResponse.json({ error: 'Unable to read video' }, { status: 400 });
  }
  const media = Buffer.concat(chunks, bytes);
  if (media.length < 16 || media.subarray(4, 8).toString() !== 'ftyp') {
    return NextResponse.json({ error: 'Invalid MP4 file header' }, { status: 415 });
  }
  const id = randomUUID();
  const saved = await prisma.$transaction(async (tx) => {
    const creatorId = auth.auth.sub;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'video:' + creatorId}, 0))`;
    const count = await tx.videoPost.count({ where: { creatorId, createdAt: { gte: new Date(Date.now() - 86400_000) } } });
    if (count >= 5) return false;
    await tx.videoPost.create({
      data: { id, title, creatorId, productId: product?.id, videoUrl: `/api/videos/${id}/media`, media },
      select: { id: true },
    });
    return true;
  });
  return saved ? NextResponse.json({ id }, { status: 201 }) : NextResponse.json({ error: 'Daily video upload limit reached' }, { status: 429 });
}

export async function PATCH(req: Request) {
  const auth = await withAuth(req);
  if (!auth.ok) return auth.response;
  const input = action.safeParse(await req.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: 'Invalid video action' }, { status: 400 });
  const data = input.data;
  const userId = auth.auth.sub;
  if (data.action === 'hide' && auth.auth.role !== 'ADMIN') return NextResponse.json({ error: 'Administrator required' }, { status: 403 });

  const updated = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "VideoPost" WHERE "id" = ${data.id} FOR UPDATE`;
    const post = await tx.videoPost.findFirst({ where: { id: data.id, visibility: 'PUBLIC' }, select: { id: true, creatorId: true } });
    if (!post) return false;
    if (data.action === 'hide') {
      await tx.videoPost.update({ where: { id: post.id }, data: { visibility: 'HIDDEN' }, select: { id: true } });
    } else if (data.action === 'like') {
      const added = await tx.videoLike.createMany({ data: { userId, videoId: post.id }, skipDuplicates: true });
      if (added.count) await tx.videoPost.update({ where: { id: post.id }, data: { likes: { increment: 1 } }, select: { id: true } });
    } else if (data.action === 'comment') {
      await tx.videoComment.create({ data: { userId, videoId: post.id, text: data.text } });
      await tx.videoPost.update({ where: { id: post.id }, data: { commentsCount: { increment: 1 } }, select: { id: true } });
    } else if (post.creatorId !== userId) {
      await tx.follow.createMany({ data: { followerId: userId, targetId: post.creatorId }, skipDuplicates: true });
    } else {
      return false;
    }
    return true;
  });
  return updated ? NextResponse.json({ success: true }) : NextResponse.json({ error: 'Video action unavailable' }, { status: 409 });
}
