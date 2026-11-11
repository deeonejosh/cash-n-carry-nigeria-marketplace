import { activeDeal } from '@/lib/flash-deals';
import type { Prisma } from '@prisma/client';
import type { Product } from '@/lib/data';

export const publicProductFilter = {
  published: true,
  seller: { status: 'VERIFIED' },
} satisfies Prisma.ProductWhereInput;

export const catalogRelations = { seller: { select: { storefrontName: true } }, category: true } as const;

type CatalogProduct = Prisma.ProductGetPayload<{ include: typeof catalogRelations }>;

export function toProduct(product: CatalogProduct): Product {
  const deal = activeDeal(product);
  return {
    id: product.id,
    slug: product.slug,
    title: product.title,
    description: product.description,
    brand: product.seller.storefrontName,
    category: product.category?.name ?? '',
    price: Number(deal?.price ?? product.price),
    compareAt: Number(deal ? product.price : product.compareAtPrice ?? product.price),
    image: product.imageUrl,
    rating: product.rating,
    reviews: product.reviewCount,
  };
}
