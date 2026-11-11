'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LiveRefresh() {
  const router = useRouter();
  useEffect(() => {
    const stream = new EventSource('/api/events');
    const refresh = () => router.refresh();
    stream.addEventListener('notification', refresh);
    stream.addEventListener('ready', refresh);
    const fallback = window.setInterval(() => {
      if (stream.readyState !== EventSource.OPEN && document.visibilityState === 'visible') refresh();
    }, 30000);
    return () => { stream.close(); window.clearInterval(fallback); };
  }, [router]);
  return null;
}
