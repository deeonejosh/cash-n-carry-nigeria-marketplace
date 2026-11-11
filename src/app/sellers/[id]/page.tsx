import { notFound } from 'next/navigation';
import ProductCard from '@/components/ui/ProductCard';
import { catalogRelations, toProduct } from '@/lib/catalog';
import MessageForm from '@/app/messages/MessageForm';
import GiftForm from "@/app/coins/GiftForm";
import { getPageUser } from '@/lib/page-auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function Storefront({ params: input }: { params: Promise<{ id: string }> }) {
  const params = await input;
  const seller = await prisma.sellerProfile.findFirst({
    where: { id: params.id, status: 'VERIFIED' },
    select: {
      storefrontName: true,
      userId: true,
      storeDescription: true,
      location: true,
      products: { where: { published: true }, include: catalogRelations, orderBy: { createdAt: 'desc' }, take: 48 },
    },
  });
  if (!seller) notFound();
  const viewer = await getPageUser();

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-8">
      <section className="rounded-[30px] bg-gradient-to-r from-emerald-700 to-emerald-900 p-7 text-white">
        <h1 className="text-3xl font-black">{seller.storefrontName}</h1>
        {seller.location && <p className="mt-2">{seller.location}</p>}
        {seller.storeDescription && <p className="mt-2">{seller.storeDescription}</p>}
      </section>
      {viewer && viewer.sub !== seller.userId && <MessageForm receiverId={seller.userId} />}
      {viewer && viewer.sub !== seller.userId && <GiftForm recipientId={seller.userId} />}
      {seller.products.length === 0 && <p>No products are listed yet.</p>}
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {seller.products.map((product) => <ProductCard key={product.id} product={toProduct(product)} />)}
      </div>
    </main>
  );
}
