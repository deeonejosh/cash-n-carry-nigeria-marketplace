import Link from 'next/link';
import { getPageUser } from '@/lib/page-auth';
import { prisma } from '@/lib/prisma';
import DisputeForm from './DisputeForm';

export default async function Disputes({ searchParams: input }: { searchParams: Promise<{ orderId?: string }> }) {
  const searchParams = await input;
  const user = await getPageUser();
  if (!user) return <main className="p-8"><Link href="/profile">Sign in to view disputes</Link></main>;
  const orderId = typeof searchParams.orderId === 'string' ? searchParams.orderId : '';
  const [disputes, order] = await Promise.all([
    prisma.dispute.findMany({ where: { openedById: user.sub }, orderBy: { createdAt: 'desc' }, take: 50 }),
    orderId ? prisma.order.findFirst({
      where: { id: orderId, userId: user.sub, status: { in: ['PAID', 'PACKING', 'SHIPPED', 'DELIVERED'] } }, select: { id: true },
    }) : null,
  ]);
  return (
    <main className="mx-auto max-w-4xl space-y-4 p-6">
      <h1 className="text-3xl font-black text-emerald-950">Order disputes</h1>
      {order && !disputes.some((item) => item.orderId === order.id && item.status === 'OPEN') && <DisputeForm orderId={order.id} />}
      {!order && disputes.length === 0 && <p>No disputes. Open a case from a paid order.</p>}
      {disputes.map((item) => (
        <article key={item.id} className="space-y-2 rounded-2xl border bg-white p-4">
          <h2 className="font-bold">Order {item.orderId}</h2>
          <p>{item.reason} · {item.status}</p>
          <p>{item.description}</p>
          {item.resolution && <p className="font-semibold">{item.resolution}</p>}
        </article>
      ))}
    </main>
  );
}
