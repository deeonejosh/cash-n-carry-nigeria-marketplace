import Link from 'next/link';
import { getPageUser } from '@/lib/page-auth';
import { prisma } from '@/lib/prisma';
import { currency } from '@/lib/data';

export default async function SellerSettlements() {
  const user = await getPageUser();
  if (user?.role !== 'SELLER') return <main className="p-8"><Link href="/seller/dashboard">Sign in as a seller</Link></main>;
  const allocations = await prisma.sellerSettlement.findMany({
    where: { seller: { userId: user.sub } }, orderBy: { createdAt: 'desc' }, take: 50,
    select: { id: true, gross: true, createdAt: true, payment: { select: { orderId: true, status: true } } },
  });
  return (
    <main className="mx-auto max-w-5xl space-y-4 p-6">
      <h1 className="text-3xl font-black text-emerald-950">Seller payment allocations</h1>
      <p>Gross order amounts before fees, refund adjustments or payouts.</p>
      {allocations.length === 0 && <p>No captured payments have been allocated yet.</p>}
      {allocations.map((item) => (
        <article key={item.id} className="rounded-2xl border bg-white p-4">
          <h2 className="font-bold">Order {item.payment.orderId}</h2>
          <p>{currency(Number(item.gross))} · {item.payment.status}</p>
        </article>
      ))}
    </main>
  );
}
