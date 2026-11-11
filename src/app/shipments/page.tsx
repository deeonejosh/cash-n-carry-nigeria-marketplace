import Link from 'next/link';
import { getPageUser } from '@/lib/page-auth';
import { prisma } from '@/lib/prisma';
import UpdateShipment from './UpdateShipment';
import LiveRefresh from '@/app/notifications/LiveRefresh';

export default async function ShipmentsPage() {
  const user = await getPageUser();
  if (!user) return <main className="p-8"><Link href="/profile">Sign in to view shipments</Link></main>;
  const shipments = await prisma.orderShipment.findMany({
    where: user.role === 'ADMIN' ? {} : user.role === 'SELLER'
      ? { seller: { userId: user.sub, status: 'VERIFIED' }, order: { status: { in: ['PAID', 'PACKING', 'SHIPPED', 'DELIVERED'] } } }
      : { order: { userId: user.sub } },
    select: {
      id: true, status: true, carrier: true, trackingRef: true,
      order: { select: { id: true, status: true, shippingAddress: true } },
      trackingEvents: { orderBy: { occurredAt: 'desc' }, take: 10, select: { id: true, status: true, occurredAt: true } },
      seller: { select: { storefrontName: true } },
      items: { select: { id: true, quantity: true, product: { select: { title: true } } } },
    },
    orderBy: { order: { createdAt: 'desc' } }, take: 50,
  });
  return (
    <main className="mx-auto max-w-5xl space-y-4 p-6">
      <LiveRefresh />
      <h1 className="text-3xl font-black text-emerald-950">Shipments</h1>
      {shipments.length === 0 && <p>No split shipments yet.</p>}
      {shipments.map((shipment) => {
        const paid = ['PAID', 'PACKING', 'SHIPPED'].includes(shipment.order.status);
        const next = shipment.status === 'PENDING' ? 'PACKING' : shipment.status === 'PACKING' ? 'SHIPPED' : shipment.status === 'SHIPPED' && user.role === 'ADMIN' ? 'DELIVERED' : null;
        return (
          <article key={shipment.id} className="space-y-2 rounded-2xl border bg-white p-4">
            <h2 className="font-bold">{shipment.seller.storefrontName}</h2>
            <p>Order {shipment.order.id} · {['CANCELLED', 'REFUNDED'].includes(shipment.order.status) ? shipment.order.status : shipment.status}</p>
            {shipment.carrier && <p>{shipment.carrier} · {shipment.trackingRef}</p>}
            {shipment.trackingEvents.length > 0 && <ul className="text-sm">
              {shipment.trackingEvents.map((event) => <li key={event.id}>{event.status.replaceAll('_', ' ')} · {event.occurredAt.toISOString().slice(0, 16).replace('T', ' ')} UTC</li>)}
            </ul>}
            {user.role !== 'BUYER' && paid && <p className="whitespace-pre-wrap">{shipment.order.shippingAddress}</p>}
            <ul>{shipment.items.map((item) => <li key={item.id}>{item.quantity} × {item.product.title}</li>)}</ul>
            {user.role !== 'BUYER' && paid && next && <UpdateShipment id={shipment.id} status={next} />}
          </article>
        );
      })}
    </main>
  );
}
