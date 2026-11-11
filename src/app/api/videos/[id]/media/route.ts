import { prisma } from '@/lib/prisma';

export async function GET(req: Request, { params: input }: { params: Promise<{ id: string }> }) {
  const params = await input;
  const post = await prisma.videoPost.findFirst({
    where: { id: params.id, visibility: 'PUBLIC' }, select: { media: true },
  });
  if (!post?.media) return new Response(null, { status: 404 });
  const media = post.media;
  const headers = new Headers({
    'content-type': 'video/mp4', 'x-content-type-options': 'nosniff',
    'cache-control': 'no-store', 'accept-ranges': 'bytes',
  });
  const range = req.headers.get('range');
  if (range) {
    const parsed = /^bytes=(\d+)-(\d*)$/.exec(range);
    const start = parsed ? Number(parsed[1]) : -1;
    const end = parsed?.[2] ? Math.min(Number(parsed[2]), media.length - 1) : media.length - 1;
    if (start < 0 || start > end) {
      headers.set('content-range', `bytes */${media.length}`);
      return new Response(null, { status: 416, headers });
    }
    headers.set('content-range', `bytes ${start}-${end}/${media.length}`);
    headers.set('content-length', String(end - start + 1));
    return new Response(new Uint8Array(media.subarray(start, end + 1)), { status: 206, headers });
  }
  headers.set('content-length', String(media.length));
  return new Response(new Uint8Array(media), { headers });
}
