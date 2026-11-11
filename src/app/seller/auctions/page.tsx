import Link from 'next/link';
import { getPageUser } from '@/lib/page-auth';
import { prisma } from '@/lib/prisma';
import AuctionForm from './AuctionForm';

export default async function SellerAuctions() {
  const user = await getPageUser();
  const products = user?.role === 'SELLER' ? await prisma.product.findMany({
    where: { published: true, stock: { gt: 0 }, seller: { userId: user.sub, status: 'VERIFIED' } },
    select: { id: true, title: true }, take: 50,
  }) : [];

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-6">
      <h1 className="text-3xl font-black text-emerald-950">Create an auction</h1>
      <Link href="/auctions" className="font-bold text-emerald-800">View auctions</Link>
      {products.length ? <AuctionForm products={products} /> : <p>A published product with available stock is required.</p>}
    </main>
  );
}
