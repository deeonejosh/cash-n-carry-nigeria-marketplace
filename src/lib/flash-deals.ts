import type { Prisma } from '@prisma/client';

type DealFields = {
  price: Prisma.Decimal;
  dealPrice: Prisma.Decimal | null;
  dealStartsAt: Date | null;
  dealEndsAt: Date | null;
  dealRemaining: number | null;
};

export function activeDeal(product: DealFields, now = new Date()) {
  const { dealPrice, dealStartsAt, dealEndsAt, dealRemaining } = product;
  if (!dealPrice || !dealStartsAt || !dealEndsAt || !dealRemaining ||
      dealStartsAt > now || dealEndsAt <= now || !dealPrice.lt(product.price)) return null;
  return { price: dealPrice, startsAt: dealStartsAt, endsAt: dealEndsAt, remaining: dealRemaining };
}
