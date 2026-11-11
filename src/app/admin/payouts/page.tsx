import { notFound } from 'next/navigation';
import { getPageUser } from '@/lib/page-auth';
import { prisma } from '@/lib/prisma';
import { currency } from '@/lib/data';
import DraftButton from './DraftButton';

export default async function Payouts() {
  if ((await getPageUser())?.role !== 'ADMIN') notFound();
  const settlements = await prisma.sellerSettlement.findMany({
    orderBy: { createdAt: 'desc' }, take: 50,
    select: { id: true, gross: true, seller: { select: { storefrontName: true } },
      payoutDraft: { select: { amount: true, commissionAmount: true, status: true } }, payment: { select: { orderId: true } } },
  });
  return (
    <main className="mx-auto max-w-5xl space-y-4 p-6">
      <h1 className="text-3xl font-black text-emerald-950">Payout drafts</h1>
      <p>Amounts after linked refunds and configured platform commission. Provider fees, taxes and transfers require separate reconciliation.</p>
      {!settlements.length && <p>No captured seller allocations.</p>}
      {settlements.map((item) => (
        <article key={item.id} className="space-y-2 rounded-2xl border bg-white p-4">
          <h2 className="font-bold">{item.seller.storefrontName} · {currency(Number(item.gross))}</h2>
          <p>Order {item.payment.orderId}</p>
          {item.payoutDraft && <p>{currency(Number(item.payoutDraft.amount))} · {item.payoutDraft.status} · commission {currency(Number(item.payoutDraft.commissionAmount))}</p>}
          <DraftButton id={item.id} />
        </article>
      ))}
    </main>
  );
}
