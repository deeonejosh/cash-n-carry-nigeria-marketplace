import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getPageUser } from '@/lib/page-auth';
import SellerReview from './SellerReview';

export default async function AdminPage() {
  const user = await getPageUser();
  if (user?.role !== 'ADMIN') {
    return <main className="mx-auto max-w-5xl p-8"><Link href="/profile" className="font-bold text-emerald-800">Sign in with an administrator account</Link></main>;
  }

  const [users, orders, refunds, queue] = await Promise.all([
    prisma.user.count(),
    prisma.order.count(),
    prisma.refund.count(),
    prisma.sellerProfile.findMany({
      where: { status: 'PENDING', kyc: { status: 'PENDING' } },
      select: { id: true, storefrontName: true, location: true },
      orderBy: { createdAt: 'asc' },
      take: 50,
    }),
  ]);

  const documents = await prisma.sellerKyc.findMany({
    where: { sellerId: { in: queue.map((item) => item.id) }, OR: [{ documentData: { not: null } }, { documentObjectKey: { not: null } }] },
    select: { sellerId: true, submittedAt: true },
  });
  const submissions = new Map(documents.map((document) => [document.sellerId, document.submittedAt?.toISOString()]));

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 md:px-8">
      <section className="rounded-[30px] bg-gradient-to-r from-slate-900 to-slate-800 p-7 text-white shadow-soft">
        <p className="text-xs font-extrabold uppercase text-slate-300">Admin Console</p>
        <h1 className="mt-2 text-3xl font-black md:text-5xl">Market operations overview</h1>
        <Link href="/admin/orders" className="mt-4 inline-block font-bold text-white underline">Manage orders</Link>
        <Link href="/shipments" className="ml-4 inline-block font-bold text-white underline">Manage shipments</Link>
        <Link href="/admin/refunds" className="ml-4 inline-block font-bold text-white underline">Sandbox refunds</Link>
        <Link href="/returns" className="ml-4 inline-block font-bold text-white underline">Manage returns</Link>
        <Link href="/admin/payouts" className="ml-4 inline-block font-bold text-white underline">Payout drafts</Link>
        <Link href="/admin/products" className="ml-4 inline-block font-bold text-white underline">Moderate products</Link>
        <Link href="/admin/coins" className="ml-4 inline-block font-bold text-white underline">Manage promotional coins</Link>
        <Link href="/admin/disputes" className="ml-4 inline-block font-bold text-white underline">Review disputes</Link>
        <Link href="/admin/buyers" className="ml-4 inline-block font-bold text-white underline">Manage buyers</Link>
      </section>
      <section className="grid gap-4 md:grid-cols-3">
        {[['Users', users], ['Orders', orders], ['Refunds', refunds]].map(([label, count]) => (
          <div key={label} className="rounded-[24px] border bg-white p-5">
            <p className="text-sm font-bold text-slate-600">{label}</p>
            <p className="mt-3 text-3xl font-black">{count}</p>
          </div>
        ))}
      </section>
      <section className="rounded-[28px] border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-black">Seller applications</h2>
        {queue.length === 0 && <p className="mt-3">No applications awaiting review.</p>}
        <ul className="mt-4 space-y-3">
          {queue.map((seller) => (
            <li key={seller.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3">
              <div><p className="font-bold">{seller.storefrontName}</p><p className="text-sm">{seller.location}</p></div>
              {submissions.has(seller.id) ? <a className="text-sm font-bold text-emerald-800" href={`/api/sellers/kyc?sellerId=${seller.id}&submission=${encodeURIComponent(submissions.get(seller.id) ?? '')}`}>Download submitted PDF</a> : <span className="text-sm">Awaiting document</span>}
              <SellerReview sellerId={seller.id} reviewedSubmission={submissions.get(seller.id)} />
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
