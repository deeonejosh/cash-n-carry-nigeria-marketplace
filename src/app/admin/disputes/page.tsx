import { notFound } from 'next/navigation';
import { getPageUser } from '@/lib/page-auth';
import { prisma } from '@/lib/prisma';
import DisputeForm from '@/app/disputes/DisputeForm';

export default async function AdminDisputes() {
  if ((await getPageUser())?.role !== 'ADMIN') notFound();
  const disputes = await prisma.dispute.findMany({
    where: { status: 'OPEN' }, orderBy: { createdAt: 'asc' }, take: 50,
  });
  return (
    <main className="mx-auto max-w-4xl space-y-4 p-6">
      <h1 className="text-3xl font-black text-emerald-950">Open disputes</h1>
      {disputes.length === 0 && <p>No open disputes.</p>}
      {disputes.map((item) => (
        <article key={item.id} className="space-y-2 rounded-2xl border bg-white p-4">
          <h2 className="font-bold">Order {item.orderId}</h2>
          <p>{item.reason} · {item.description}</p>
          <DisputeForm id={item.id} />
        </article>
      ))}
    </main>
  );
}
