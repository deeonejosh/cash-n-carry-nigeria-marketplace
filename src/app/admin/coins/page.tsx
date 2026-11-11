import { notFound } from 'next/navigation';
import { getPageUser } from '@/lib/page-auth';
import { prisma } from '@/lib/prisma';
import CreditForm from './CreditForm';

export default async function AdminCoins() {
  if ((await getPageUser())?.role !== 'ADMIN') notFound();
  const users = await prisma.user.findMany({
    where: { isActive: true }, select: { id: true, name: true, email: true }, orderBy: { createdAt: 'desc' }, take: 100,
  });
  return (
    <main className="mx-auto max-w-4xl space-y-4 p-6">
      <h1 className="text-3xl font-black text-emerald-950">Promotional coin credits</h1>
      <CreditForm users={users} />
    </main>
  );
}
