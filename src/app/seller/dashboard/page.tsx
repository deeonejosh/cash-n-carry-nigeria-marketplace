import Link from 'next/link';
import { getPageUser } from '@/lib/page-auth';
import { prisma } from '@/lib/prisma';

export default async function SellerDashboardPage() {
  const user = await getPageUser();
  if (!user) {
    return <main className="mx-auto max-w-5xl p-8"><Link href="/profile" className="font-bold text-emerald-800">Sign in to view your seller dashboard</Link></main>;
  }
  const seller = await prisma.sellerProfile.findUnique({
    where: { userId: user.sub },
    select: { id: true, storefrontName: true, status: true, kyc: { select: { status: true } }, _count: { select: { products: true } } },
  });
  if (!seller) {
    return <main className="mx-auto max-w-5xl p-8"><Link href="/seller/register" className="font-bold text-emerald-800">Apply to become a seller</Link></main>;
  }
  const orders = await prisma.order.count({ where: { items: { some: { product: { sellerId: seller.id } } } } });

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 md:px-8">
      <section className="rounded-[30px] bg-gradient-to-r from-emerald-700 to-emerald-900 p-7 text-white shadow-soft">
        <p className="text-xs font-extrabold uppercase text-emerald-100">Seller dashboard</p>
        <h1 className="mt-2 text-3xl font-black md:text-5xl">{seller.storefrontName}</h1>
      </section>
      <section className="grid gap-4 md:grid-cols-3">
        {[['Orders', orders], ['Products', seller._count.products], ['Application status', seller.kyc?.status ?? seller.status]].map(([label, value]) => (
          <div key={label} className="rounded-[24px] border bg-white p-5">
            <p className="text-sm font-bold text-slate-600">{label}</p>
            <p className="mt-3 text-2xl font-black">{value}</p>
          </div>
        ))}
      </section>
      {seller.status === 'VERIFIED' && <Link href={`/sellers/${seller.id}`} className="font-bold text-emerald-800">View storefront</Link>}
      {seller.status === 'VERIFIED' && <Link href="/seller/products" className="ml-4 font-bold text-emerald-800">Manage products</Link>}
      {seller.status === 'VERIFIED' && <Link href="/seller/auctions" className="ml-4 font-bold text-emerald-800">Manage auctions</Link>}
      <Link href="/seller/register" className="ml-4 font-bold text-emerald-800">Edit store details</Link>
      {seller.status === 'VERIFIED' && <Link href="/seller/orders" className="ml-4 font-bold text-emerald-800">Orders and sales</Link>}
      {seller.status === 'VERIFIED' && <Link href="/shipments" className="ml-4 font-bold text-emerald-800">Split shipments</Link>}
      {seller.status === 'VERIFIED' && <Link href="/live" className="ml-4 font-bold text-emerald-800">Livestreams</Link>}
      {seller.status === 'VERIFIED' && <Link href="/seller/deals" className="ml-4 font-bold text-emerald-800">Schedule flash deals</Link>}
      {seller.status === 'VERIFIED' && <Link href="/seller/settlements" className="ml-4 font-bold text-emerald-800">Payment allocations</Link>}
    </main>
  );
}
