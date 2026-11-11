import Link from 'next/link';
import { getPageUser } from '@/lib/page-auth';
import { prisma } from '@/lib/prisma';
import ReturnForm from './ReturnForm';
import ReturnReview from './ReturnReview';
import RefundControl from '@/app/admin/refunds/RefundControl';

export default async function Returns() {
  const user = await getPageUser();
  if (!user) return <main className="p-8"><Link href="/profile">Sign in to view returns</Link></main>;
  const admin = user.role === 'ADMIN';
  const items = await prisma.orderItem.findMany({
    where: admin ? { returns: { some: {} } } : {
      order: { userId: user.sub }, OR: [
        { shipment: { status: { in: ['SHIPPED', 'DELIVERED'] } } },
        { shipmentId: null, order: { status: { in: ['SHIPPED', 'DELIVERED'] } } },
        { returns: { some: {} } },
      ],
    },
    select: {
      id: true, quantity: true, price: true, product: { select: { title: true } },
      shipment: { select: { status: true } },
      order: { select: { id: true, status: true, payments: { where: { status: 'SUCCESS' }, take: 1, select: { id: true } } } },
      returns: { select: { id: true, status: true, reason: true, quantity: true, refunds: { where: { status: { not: 'FAILED' } }, select: { id: true } } } },
    },
    orderBy: { order: { createdAt: 'desc' } }, take: 50,
  });
  return (
    <main className="mx-auto max-w-5xl space-y-4 p-6">
      <h1 className="text-3xl font-black text-emerald-950">{admin ? 'Manage returns' : 'Returns'}</h1>
      {!items.length && <p>No items to show.</p>}
      {items.map((item) => {
        const available = item.quantity - item.returns.filter((entry) => entry.status !== 'REJECTED').reduce((sum, entry) => sum + entry.quantity, 0);
        const eligible = !['REFUNDED', 'CANCELLED', 'PENDING'].includes(item.order.status) &&
          ['SHIPPED', 'DELIVERED'].includes(item.shipment?.status ?? item.order.status);
        return (
          <article key={item.id} className="space-y-3 rounded-2xl border bg-white p-4">
            <h2 className="font-bold">{item.product.title} · {item.quantity} ordered</h2>
            <p className="text-sm text-slate-600">Order {item.order.id}</p>
            {!admin && eligible && available > 0 && <ReturnForm itemId={item.id} max={available} />}
            {item.returns.map((entry) => (
              <div key={entry.id} className="space-y-2 border-t py-2">
                <p>{entry.quantity} · {entry.status} · {entry.reason}</p>
                {admin && <ReturnReview id={entry.id} status={entry.status} />}
                {admin && entry.status === 'RECEIVED' && !entry.refunds.length && item.order.payments[0] &&
                  <RefundControl paymentId={item.order.payments[0].id} max={item.price.times(entry.quantity).toNumber()} returnId={entry.id} />}
              </div>
            ))}
          </article>
        );
      })}
    </main>
  );
}
