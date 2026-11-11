import Link from 'next/link';
import { getPageUser } from '@/lib/page-auth';
import { prisma } from '@/lib/prisma';
import ProductForm from './ProductForm';

export default async function SellerProducts() {
  const user = await getPageUser();
  const seller = user?.role === 'SELLER' ? await prisma.sellerProfile.findFirst({
    where: { userId: user.sub, status: 'VERIFIED' },
    select: {
      products: {
        take: 50, orderBy: { updatedAt: 'desc' },
        select: { slug: true, title: true, description: true, price: true, stock: true, published: true },
      },
    },
  }) : null;
  if (!seller) return <main className="p-8"><Link href="/seller/dashboard">A verified seller account is required</Link></main>;

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-6">
      <h1 className="text-3xl font-black text-emerald-950">Products and inventory</h1>
      <ProductForm />
      {seller.products.map((product) => <ProductForm key={product.slug} product={{ ...product, price: Number(product.price) }} />)}
    </main>
  );
}
