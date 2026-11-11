import Link from 'next/link';
import ProductCard from '@/components/ui/ProductCard';
import { categories } from '@/lib/data';

import { prisma } from '@/lib/prisma';
import { publicProductFilter, catalogRelations, toProduct } from '@/lib/catalog';

export default async function ShopPage({ searchParams: input }: { searchParams: Promise<{ category?: string; q?: string }> }) {
  const searchParams = await input;
  const category = typeof searchParams.category === 'string' ? searchParams.category : '';
  const q = typeof searchParams.q === 'string' ? searchParams.q.trim().slice(0, 100) : '';
  const sellers = await prisma.sellerProfile.findMany({
    where: { status: 'VERIFIED' },
    select: { id: true, storefrontName: true, location: true, rating: true },
    orderBy: { rating: 'desc' },
    take: 4,
  });
  const products = await prisma.product.findMany({
    where: {
      ...publicProductFilter,
      ...(category ? { category: { slug: category } } : {}),
      ...(q ? { OR: [{ title: { contains: q, mode: 'insensitive' } }, { description: { contains: q, mode: 'insensitive' } }] } : {}),
    },
    include: catalogRelations,
    orderBy: { createdAt: 'desc' },
    take: 48,
  });

  return (
    <div className="mx-auto max-w-7xl space-y-10 px-4 py-8 md:px-8">
      <section className="rounded-[30px] bg-gradient-to-r from-emerald-700 to-emerald-900 p-7 text-white shadow-soft">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-emerald-100">Shop now</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight md:text-5xl">Discover all the best deals</h1>
          </div>
          <Link href="/seller/register" className="inline-flex items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-bold text-emerald-900">Sell with us</Link>
          <Link href="/auctions" className="font-bold text-white underline">Auctions</Link>
          <Link href="/flash-deals" className="font-bold text-white underline">Flash deals</Link>
          <Link href="/live" className="font-bold text-white underline">Live shopping</Link>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-black text-slate-900">Categories</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {categories.map((category) => (
            <Link key={category.id} href={`/shop?category=${category.slug}`} className={`rounded-[24px] bg-gradient-to-br ${category.accent} p-4 text-white shadow-sm`}>
              <div className="text-2xl">{category.icon}</div>
              <div className="mt-10 text-lg font-bold">{category.name}</div>
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-black text-slate-900">Popular stores</h2>
          <Link href="/sellers" className="text-sm font-bold text-emerald-800">View all</Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {sellers.length === 0 && <p>No verified stores yet.</p>}
          {sellers.map((seller) => (
            <div key={seller.id} className="overflow-hidden rounded-[24px] border border-slate-100 bg-white shadow-sm">
              <div className="p-4">
                <div className="flex items-center gap-3">
                  <div>
                    <div className="font-bold text-slate-900">{seller.storefrontName}</div>
                    <div className="text-xs text-slate-500">{seller.location}</div>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                  <span>★ {seller.rating}</span>
                </div>
              </div>
              <div className="px-4 pb-4">
                <Link href={`/sellers/${seller.id}`} className="inline-flex w-full items-center justify-center rounded-full border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-emerald-200 hover:text-emerald-800">Visit store</Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <form action="/shop" className="flex gap-2">
          {category && <input type="hidden" name="category" value={category} />}
          <input aria-label="Search products" name="q" defaultValue={q} maxLength={100} className="min-w-0 flex-1 rounded-xl border p-2" />
          <button className="rounded-xl bg-emerald-800 px-4 font-bold text-white">Search</button>
        </form>
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-black text-slate-900">Products</h2>
          <Link href="/shop" className="text-sm font-bold text-emerald-800">Browse all</Link>
        </div>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {products.map((product) => <ProductCard key={product.slug} product={toProduct(product)} />)}
          {products.length === 0 && <p>No matching products.</p>}
        </div>
      </section>
    </div>
  );
}
