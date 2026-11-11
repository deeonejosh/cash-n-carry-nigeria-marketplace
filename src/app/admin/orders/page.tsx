import { notFound } from 'next/navigation';
import { getPageUser } from '@/lib/page-auth';
import { prisma } from '@/lib/prisma';
import OrderProgress from './OrderProgress';

const nextStatus = { PAID: 'PACKING', PACKING: 'SHIPPED', SHIPPED: 'DELIVERED' } as const;

export default async function AdminOrders() {
  if ((await getPageUser())?.role !== 'ADMIN') notFound();
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: 'desc' }, take: 50, select: { id: true, status: true, _count: { select: { shipments: true } } },
  });

  return (
    <main className="mx-auto max-w-4xl space-y-4 p-6">
      <h1 className="text-3xl font-black text-emerald-950">Manage orders</h1>
      {orders.length === 0 && <p>No orders yet.</p>}
      {orders.map((order) => (
        <article key={order.id} className="space-y-2 rounded-2xl border bg-white p-4">
          <h2 className="font-bold">{order.id}</h2>
          <p>{order.status}</p>
          {order._count.shipments === 0 && order.status in nextStatus && <OrderProgress id={order.id} status={nextStatus[order.status as keyof typeof nextStatus]} />}
        </article>
      ))}
    </main>
  );
}
