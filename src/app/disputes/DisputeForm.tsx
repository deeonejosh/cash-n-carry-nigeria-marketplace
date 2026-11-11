'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

type Props = { orderId: string } | { id: string };

export default function DisputeForm(props: Props) {
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const submitting = 'orderId' in props;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setStatus('');
    try {
      const response = await fetch('/api/disputes', {
        method: submitting ? 'POST' : 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...props, ...Object.fromEntries(data) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Unable to save dispute.');
      setStatus(submitting ? 'Dispute submitted.' : 'Resolution saved.');
      form.reset();
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to save dispute.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-2xl border bg-white p-4">
      {submitting && <label>Reason<select name="reason" className="block w-full rounded-xl border p-2"><option value="DELIVERY">Delivery</option><option value="ITEM">Item</option><option value="OTHER">Other</option></select></label>}
      <label>{submitting ? 'Describe the issue' : 'Resolution'}
        <textarea name={submitting ? 'description' : 'resolution'} required minLength={10} maxLength={2000} className="block w-full rounded-xl border p-2" />
      </label>
      <button disabled={busy} className="justify-self-start rounded-full bg-emerald-800 px-4 py-2 font-bold text-white">{submitting ? 'Submit dispute' : 'Resolve dispute'}</button>
      {status && <p role="status">{status}</p>}
    </form>
  );
}
