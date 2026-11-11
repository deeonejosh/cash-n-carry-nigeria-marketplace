import Link from 'next/link';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function SellersPage() {
  const sellers = await prisma.sellerProfile.findMany({
    where: { status: 'VERIFIED' },
    select: { id: true, storefrontName: true, location: true },
    orderBy: { storefrontName: 'asc' },
  });
  return (
    <main className="mx-auto max-w-5xl space-y-5 px-4 py-8">
      <h1 className="text-3xl font-black text-emerald-950">Verified stores</h1>
      {sellers.length === 0 && <p>No verified stores yet.</p>}
      <ul className="grid gap-4 sm:grid-cols-2">
        {sellers.map((seller) => (
          <li key={seller.id} className="rounded-2xl border bg-white p-4">
            <Link className="font-bold text-emerald-800" href={`/sellers/${seller.id}`}>{seller.storefrontName}</Link>
            {seller.location && <p className="text-sm text-slate-600">{seller.location}</p>}
          </li>
        ))}
      </ul>
    </main>
  );
}
