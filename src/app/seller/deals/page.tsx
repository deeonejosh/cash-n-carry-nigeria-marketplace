import Link from 'next/link';
import { getPageUser } from '@/lib/page-auth';
import { prisma } from '@/lib/prisma';
import ScheduleDeal from './ScheduleDeal';

export default async function SellerDeals() {
  const user = await getPageUser();
  if (user?.role !== 'SELLER') return <main className="p-8"><Link href="/seller/dashboard">Sign in as a seller</Link></main>;
  const products = await prisma.product.findMany({
    where: { published: true, stock: { gt: 0 }, seller: { userId: user.sub, status: 'VERIFIED' } },
    select: { id: true, title: true, stock: true }, take: 50,
  });
  return (
    <main className="mx-auto max-w-3xl space-y-4 p-6">
      <h1 className="text-3xl font-black text-emerald-950">Schedule a flash deal</h1>
      {products.length ? <ScheduleDeal products={products} /> : <p>A published product with stock is required.</p>}
    </main>
  );
}
