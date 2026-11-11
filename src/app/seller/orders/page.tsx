import Link from 'next/link';
import { getPageUser } from '@/lib/page-auth';
import { prisma } from '@/lib/prisma';
import { currency } from '@/lib/data';
import OrderProgress from '@/app/admin/orders/OrderProgress';

export default async function SellerOrders() {
  const user = await getPageUser();
  const seller = user?.role === 'SELLER' ? await prisma.sellerProfile.findFirst({
    where: { userId: user.sub, status: 'VERIFIED' }, select: { id: true },
  }) : null;
  if (!seller) return <main className="p-8"><Link href="/seller/dashboard">A verified seller account is required</Link></main>;
  const sellerItem = { product: { sellerId: seller.id } };
  const [orders, sales] = await Promise.all([
    prisma.order.findMany({
      where: { items: { some: sellerItem } }, orderBy: { createdAt: 'desc' }, take: 50,
      select: {
        id: true, status: true, shippingAddress: true,
        items: { where: sellerItem, select: { id: true, quantity: true, price: true, product: { select: { title: true } } } },
        _count: { select: { items: true } },
      },
    }),
    prisma.$queryRaw<{ total: string }[]>`
      SELECT COALESCE(SUM("OrderItem"."price" * "OrderItem"."quantity"), 0)::text AS total
      FROM "OrderItem" JOIN "Order" ON "Order"."id" = "OrderItem"."orderId"
      JOIN "Product" ON "Product"."id" = "OrderItem"."productId"
      WHERE "Product"."sellerId" = ${seller.id} AND "Order"."status" IN ('PAID', 'PACKING', 'SHIPPED', 'DELIVERED')
    `,
  ]);

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-6">
      <h1 className="text-3xl font-black text-emerald-950">Seller orders</h1>
      <p className="rounded-2xl bg-emerald-800 p-4 font-bold text-white">Gross paid sales · {currency(Number(sales[0]?.total ?? 0))}</p>
      {orders.length === 0 && <p>No orders yet.</p>}
      {orders.map((order) => {
        const singleSeller = order.items.length === order._count.items;
        return (
          <article key={order.id} className="space-y-2 rounded-2xl border bg-white p-4">
            <h2 className="font-bold">{order.id}</h2>
            <p>{order.status}</p>
            <ul>{order.items.map((item) => <li key={item.id}>{item.quantity} × {item.product.title}</li>)}</ul>
            {singleSeller && ['PAID', 'PACKING', 'SHIPPED'].includes(order.status) && <p className="whitespace-pre-wrap">{order.shippingAddress}</p>}
            {singleSeller && order.status === 'PAID' && <OrderProgress id={order.id} status="PACKING" />}
            {singleSeller && order.status === 'PACKING' && <OrderProgress id={order.id} status="SHIPPED" />}
          </article>
        );
      })}
    </main>
  );
}
