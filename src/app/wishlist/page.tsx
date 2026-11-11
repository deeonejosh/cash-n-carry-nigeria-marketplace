import Link from 'next/link';
import ProductCard from '@/components/ui/ProductCard';
import { getPageUser } from '@/lib/page-auth';
import { catalogRelations, publicProductFilter, toProduct } from '@/lib/catalog';
import { prisma } from '@/lib/prisma';
import RemoveSaved from './RemoveSaved';

export default async function WishlistPage() {
  const user = await getPageUser();
  if (user?.role !== 'BUYER') return <main className="p-8"><Link href="/profile">Sign in as a buyer</Link></main>;
  const items = await prisma.wishlistItem.findMany({
    where: { userId: user.sub, product: publicProductFilter },
    include: { product: { include: catalogRelations } },
    take: 50, orderBy: { createdAt: 'desc' },
  });
  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="mb-5 text-3xl font-black text-emerald-950">Your wishlist</h1>
      {items.length === 0 && <p>No saved products.</p>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map(({ product }) => (
          <div key={product.id}>
            <ProductCard product={toProduct(product)} />
            <RemoveSaved productId={product.id} />
          </div>
        ))}
      </div>
    </main>
  );
}
