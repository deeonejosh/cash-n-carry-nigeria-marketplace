import { notFound } from 'next/navigation';
import { getPageUser } from '@/lib/page-auth';
import { prisma } from '@/lib/prisma';
import ModerateProduct from './ModerateProduct';

export default async function AdminProducts() {
  if ((await getPageUser())?.role !== 'ADMIN') notFound();
  const products = await prisma.product.findMany({
    orderBy: { updatedAt: 'desc' }, take: 50,
    select: { slug: true, title: true, description: true, published: true, seller: { select: { storefrontName: true } } },
  });

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-6">
      <h1 className="text-3xl font-black text-emerald-950">Product moderation</h1>
      {products.length === 0 && <p>No listings to review.</p>}
      {products.map((product) => (
        <article key={product.slug} className="space-y-2 rounded-2xl border bg-white p-4">
          <h2 className="font-bold">{product.title}</h2>
          <p>{product.seller.storefrontName} · {product.published ? 'Published' : 'Draft'}</p>
          <p>{product.description}</p>
          <ModerateProduct slug={product.slug} published={product.published} />
        </article>
      ))}
    </main>
  );
}
