import LiveRefresh from '@/app/notifications/LiveRefresh';
import Link from 'next/link';
import { getPageUser } from '@/lib/page-auth';
import { prisma } from '@/lib/prisma';
import MarkRead from './MarkRead';

export default async function NotificationsPage() {
  const user = await getPageUser();
  if (!user) return <main className="p-8"><Link href="/profile">Sign in to view notifications</Link></main>;
  const notifications = await prisma.notification.findMany({
    where: { userId: user.sub }, orderBy: { createdAt: 'desc' }, take: 50,
  });

  return (
    <main className="mx-auto max-w-4xl space-y-4 p-6">
      <LiveRefresh />
      <h1 className="text-3xl font-black text-emerald-950">Notifications</h1>
      {notifications.length === 0 && <p>You have no notifications.</p>}
      {notifications.map((notification) => (
        <article key={notification.id} className="space-y-2 rounded-2xl border bg-white p-4">
          <h2 className="font-bold">{notification.title}</h2>
          <p>{notification.body}</p>
          {!notification.readAt && <MarkRead id={notification.id} />}
        </article>
      ))}
    </main>
  );
}
