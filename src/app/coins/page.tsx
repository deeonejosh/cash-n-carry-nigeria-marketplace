import Link from 'next/link';
import { getPageUser } from '@/lib/page-auth';
import { prisma } from '@/lib/prisma';

export default async function CoinsPage() {
  const user = await getPageUser();
  if (!user) return <main className="p-8"><Link href="/profile">Sign in to view your coins</Link></main>;
  const [balance, activity] = await prisma.$transaction([
    prisma.coinLedger.aggregate({ where: { userId: user.sub }, _sum: { delta: true } }),
    prisma.coinLedger.findMany({ where: { userId: user.sub }, orderBy: { createdAt: 'desc' }, take: 50 }),
  ]);
  return (
    <main className="mx-auto max-w-4xl space-y-4 p-6">
      <h1 className="text-3xl font-black text-emerald-950">Promotional coins</h1>
      <p className="rounded-2xl bg-emerald-800 p-4 text-xl font-bold text-white">{balance._sum.delta ?? 0} coins</p>
      <h2 className="font-bold">Recent activity</h2>
      {activity.length === 0 && <p>No coin activity yet.</p>}
      <ul className="space-y-2">{activity.map((entry) => (
        <li key={entry.id} className="flex justify-between rounded-xl border p-3">
          <span>{entry.reason}</span><span>{entry.delta > 0 ? '+' : ''}{entry.delta}</span>
        </li>
      ))}</ul>
    </main>
  );
}
