import { notFound } from 'next/navigation';
import { getPageUser } from '@/lib/page-auth';
import { prisma } from '@/lib/prisma';
import { currency } from '@/lib/data';
import RefundControl from './RefundControl';

export default async function Refunds() {
  if ((await getPageUser())?.role !== 'ADMIN') notFound();
  const payments = await prisma.payment.findMany({
    where: { provider: { in: ['PAYSTACK', 'FLUTTERWAVE'] }, status: { in: ['SUCCESS', 'REFUNDED'] } },
    select: { id: true, provider: true, providerRef: true, amount: true, status: true, refunds: true },
    orderBy: { createdAt: 'desc' }, take: 50,
  });
  return (
    <main className="mx-auto max-w-5xl space-y-4 p-6">
      <h1 className="text-3xl font-black text-emerald-950">Sandbox refunds</h1>
      {!payments.length && <p>No verified gateway payments.</p>}
      {payments.map((payment) => {
        const available = payment.refunds.filter((refund) => refund.status !== 'FAILED')
          .reduce((amount, refund) => amount.minus(refund.amount), payment.amount);
        return (
          <article key={payment.id} className="space-y-3 rounded-2xl border bg-white p-4">
            <h2 className="font-bold">{payment.provider} · {payment.providerRef} · {currency(Number(payment.amount))}</h2>
            {payment.refunds.map((refund) => (
              <div key={refund.id} className="space-y-2 border-t py-2">
                <p>{refund.id} · {currency(Number(refund.amount))} · {refund.status}</p>
                {refund.providerRef && !['SUCCESS', 'FAILED'].includes(refund.status) && <RefundControl refundId={refund.id} />}
              </div>
            ))}
            {payment.status === 'SUCCESS' && available.gt(0) && <RefundControl paymentId={payment.id} max={Number(available)} />}
          </article>
        );
      })}
    </main>
  );
}
