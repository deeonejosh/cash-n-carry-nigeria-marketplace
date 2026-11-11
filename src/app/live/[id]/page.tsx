import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPageUser } from '@/lib/page-auth';
import { prisma } from '@/lib/prisma';
import LiveRoom from './LiveRoom';

export default async function LiveStreamPage({ params: input }: { params: Promise<{ id: string }> }) {
  const params = await input;
  const stream = await prisma.liveStream.findFirst({
    where: { id: params.id, status: 'LIVE', seller: { status: 'VERIFIED' } },
    select: { id: true, title: true, sellerId: true, seller: { select: { userId: true, storefrontName: true } } },
  });
  if (!stream) notFound();
  const user = await getPageUser();
  const host = user?.role === 'SELLER' && user.sub === stream.seller.userId;
  const [products, auctions] = host ? await Promise.all([
    prisma.product.findMany({ where: { sellerId: stream.sellerId, published: true }, select: { id: true, title: true }, take: 50 }),
    prisma.auction.findMany({ where: { sellerId: stream.sellerId, endsAt: { gt: new Date() }, closedAt: null }, select: { id: true, title: true }, take: 50 }),
  ]) : [[], []];
  return (
    <main className="mx-auto max-w-5xl space-y-4 p-6">
      <h1 className="text-3xl font-black text-emerald-950">{stream.title}</h1>
      <p>{stream.seller.storefrontName}</p>
      {user ? <LiveRoom id={stream.id} host={host} products={products} auctions={auctions} /> : <Link href="/profile">Sign in to join</Link>}
    </main>
  );
}
