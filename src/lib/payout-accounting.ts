import { Prisma } from '@prisma/client';

export function commissionRate(value = process.env.SELLER_COMMISSION_BPS ?? '0') {
  if (!/^\d{1,5}$/.test(value) || Number(value) > 10000) throw new Error('Invalid seller commission rate');
  return Number(value);
}

export function netPayout(refundAdjustedGross: Prisma.Decimal, basisPoints: number) {
  const commissionAmount = refundAdjustedGross.times(basisPoints).div(10000).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  return { amount: refundAdjustedGross.minus(commissionAmount), commissionAmount };
}
