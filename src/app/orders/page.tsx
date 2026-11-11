import LiveRefresh from '@/app/notifications/LiveRefresh';
import Link from 'next/link';
import { getPageUser } from '@/lib/page-auth';
import { prisma } from '@/lib/prisma';
import { currency } from '@/lib/data';
import ResumeCheckout from "./ResumeCheckout";

export default async function OrdersPage() {
  const user = await getPageUser();
  if (!user) return <main className="p-8"><Link href="/profile">Sign in to view your orders</Link></main>;
  const orders = await prisma.order.findMany({
    where: { userId: user.sub },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true, status: true, total: true, createdAt: true, reservationEnds: true,
      items: { select: { quantity: true, product: { select: { title: true } } } },
      payments: {
        where: { status: 'PENDING' },
        select: { providerRef: true, checkoutUrl: true },
        orderBy: { createdAt: 'desc' }, take: 1,
      },
    },
  });
  return (
    <main className="mx-auto max-w-4xl space-y-4 p-6">
      <LiveRefresh />
      <h1 className="text-3xl font-black text-emerald-950">Your orders</h1>
      <Link href="/disputes" className="font-bold text-emerald-800">View disputes</Link>
      <Link href="/returns" className="ml-4 font-bold text-emerald-800">Returns</Link>
      <Link href="/shipments" className="ml-4 font-bold text-emerald-800">Track shipments</Link>
      {orders.length === 0 && <p>No orders yet.</p>}
      {orders.map((order) => (
        <article key={order.id} className="space-y-2 rounded-2xl border bg-white p-4">
          <h2 className="font-bold">{order.id}</h2>
          <p>{order.status} · {currency(Number(order.total))}</p>
          {["PAID", "PACKING", "SHIPPED", "DELIVERED"].includes(order.status) && <Link href={`/disputes?orderId=${order.id}`} className="text-sm font-bold text-emerald-800">Report an issue</Link>}
          <ul>{order.items.map((item, index) => <li key={index}>{item.quantity} × {item.product.title}</li>)}</ul>
          {order.status === 'PENDING' && order.payments.length === 0 && (!order.reservationEnds || order.reservationEnds > new Date()) && <ResumeCheckout id={order.id} />}
          {order.status === 'PENDING' && order.payments.map((payment) => (
            <div key={payment.providerRef} className="flex flex-wrap gap-4 text-sm font-bold text-emerald-800">
              {payment.checkoutUrl && <a href={payment.checkoutUrl}>Resume test payment</a>}
              {payment.providerRef && <Link href={`/checkout/complete?reference=${encodeURIComponent(payment.providerRef)}`}>Check payment</Link>}
            </div>
          ))}
        </article>
      ))}
    </main>
  );
}
