import { Prisma } from '@prisma/client';
import { expect, it } from 'vitest';
import { commissionRate, netPayout } from '@/lib/payout-accounting';

it('deducts commission after linked refunds and rounds half-up to kobo', () => {
  const adjusted = new Prisma.Decimal('101.05').minus('1.00');
  const result = netPayout(adjusted, commissionRate('1000'));
  expect(result.commissionAmount.toFixed(2)).toBe('10.01');
  expect(result.amount.toFixed(2)).toBe('90.04');
});

it('rejects ambiguous and out-of-range commission values', () => {
  for (const value of ['2.5', '-1', '10001', '2%']) expect(() => commissionRate(value)).toThrow();
});
