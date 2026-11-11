'use client';

import { useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

type Props = { paymentId: string; max: number; returnId?: string } | { refundId: string };

export default function RefundControl(props: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const request = useRef<{ id: string; signature: string } | null>(null);
  const create = 'paymentId' in props;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    let body: object;
    if ('paymentId' in props) {
      const amountKobo = Math.round(Number(form.get('amount')) * 100);
      const reason = String(form.get('reason')).trim();
      const signature = JSON.stringify([amountKobo, reason]);
      if (request.current?.signature !== signature) request.current = { id: crypto.randomUUID(), signature };
      body = { action: 'create', paymentId: props.paymentId, requestId: request.current.id, amountKobo, reason, returnId: props.returnId };
    } else {
      body = { action: 'refresh', refundId: props.refundId };
    }
    setBusy(true);
    setStatus('');
    try {
      const response = await fetch('/api/admin/refunds', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Refund action failed.');
      setStatus(`Refund status: ${result.refund.status}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Refund action failed.');
    } finally {
      router.refresh();
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
      {'paymentId' in props && <>
        <label>Refund amount (₦)<input name="amount" required type="number" min="0.01" max={props.max} defaultValue={props.returnId ? props.max : undefined} readOnly={!!props.returnId} step="0.01" className="block rounded-xl border p-2" /></label>
        <label>Reason<input name="reason" required minLength={5} maxLength={500} className="block rounded-xl border p-2" /></label>
      </>}
      <button disabled={busy} className="rounded-full bg-emerald-800 px-4 py-2 font-bold text-white">{create ? 'Submit sandbox refund' : 'Check gateway status'}</button>
      {status && <p role="status">{status}</p>}
    </form>
  );
}
