'use client';

import { useEffect, useState } from 'react';

export default function PaymentStatus({ reference }: { reference: string }) {
  const [status, setStatus] = useState('Checking your payment…');

  useEffect(() => {
    if (!reference) return;
    const controller = new AbortController();
    fetch('/api/payments/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reference }),
      signal: controller.signal,
    }).then(async (response) => {
      const result = await response.json();
      setStatus(response.ok ? `Payment verified for order ${result.orderId}.` : 'Payment has not been verified. Reload to check again.');
    }).catch(() => {
      if (!controller.signal.aborted) setStatus('Unable to check payment. Reload to try again.');
    });
    return () => controller.abort();
  }, [reference]);

  return <p role="status" className="mt-3">{reference ? status : 'No payment reference was supplied.'}</p>;
}
