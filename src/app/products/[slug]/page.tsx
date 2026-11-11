import Link from 'next/link';
import Image from 'next/image';
import { currency } from '@/lib/data';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { publicProductFilter, catalogRelations, toProduct } from '@/lib/catalog';
import AddToCart from './AddToCart';

export const dynamic = 'force-dynamic';

export default async function ProductPage({ params: input }: { params: Promise<{ slug: string }> }) {
  const params = await input;
  const item = await prisma.product.findFirst({ where: { ...publicProductFilter, slug: params.slug }, include: catalogRelations });
  if (!item) notFound();
  const product = toProduct(item);
  const related = (await prisma.product.findMany({
    where: { ...publicProductFilter, id: { not: item.id } },
    include: catalogRelations,
    take: 3,
  })).map(toProduct);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-8">
      <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[30px] border border-slate-100 bg-white p-4 shadow-sm">
          <div className="relative h-[420px] overflow-hidden rounded-[22px] bg-slate-50">
            {product.image && <Image src={product.image} alt={product.title} fill className="object-cover" />}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[26px] border border-slate-100 bg-white p-6 shadow-sm">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-emerald-700">{product.category}</p>
            <h1 className="mt-3 text-3xl font-black text-slate-900">{product.title}</h1>
            <div className="mt-3 flex items-center gap-2 text-sm text-slate-500">
              <span>★ {product.rating}</span>
              <span>({product.reviews} reviews)</span>
            </div>
            <div className="mt-5 flex items-end gap-3">
              <span className="text-3xl font-black text-slate-900">{currency(product.price)}</span>
              {product.compareAt > product.price && <span className="text-sm text-slate-400 line-through">{currency(product.compareAt)}</span>}
            </div>
            <p className="mt-5 text-sm leading-7 text-slate-600">{product.description}</p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <AddToCart productId={item.id} inStock={item.stock > 0} />
            </div>
          </div>

          <div className="rounded-[26px] border border-slate-100 bg-white p-6 shadow-sm">
            <p className="font-bold text-slate-900">{product.brand}</p>
          </div>
        </div>
      </div>

      <section className="mt-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-black text-slate-900">Related items</h2>
          <Link href="/shop" className="text-sm font-bold text-emerald-800">Browse more</Link>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {related.map((item) => (
            <Link key={item.slug} href={`/products/${item.slug}`} className="overflow-hidden rounded-[24px] border border-slate-100 bg-white shadow-sm">
              <div className="relative h-48 w-full bg-slate-50">
                {item.image && <Image src={item.image} alt={item.title} fill className="object-cover" />}
              </div>
              <div className="p-4">
                <div className="text-xs uppercase tracking-[0.12em] text-slate-400">{item.brand}</div>
                <div className="mt-2 text-base font-bold text-slate-900">{item.title}</div>
                <div className="mt-3 text-lg font-black text-slate-900">{currency(item.price)}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
