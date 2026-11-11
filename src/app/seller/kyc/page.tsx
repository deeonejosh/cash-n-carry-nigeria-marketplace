'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';

export default function SellerKycPage() {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = new FormData(event.currentTarget).get('document');
    if (!(file instanceof File) || file.size === 0 || file.size > 5 * 1024 * 1024) {
      setStatus('Choose a PDF up to 5 MB.');
      return;
    }
    setBusy(true);
    setStatus('');
    try {
      const response = await fetch('/api/sellers/kyc', {
        method: 'POST', headers: { 'content-type': 'application/pdf' }, body: file,
      });
      const data = await response.json();
      setStatus(response.ok ? 'Document submitted for review.' : data.error ?? 'Sign in to submit a document.');
    } catch {
      setStatus('Upload failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-6">
      <h1 className="text-3xl font-black text-emerald-950">Seller verification</h1>
      <Link href="/seller/register" className="font-bold text-emerald-800">Seller application</Link>
      <form onSubmit={upload} className="grid gap-4 rounded-2xl border bg-white p-4">
        <label className="grid gap-2">Verification document (PDF, up to 5 MB)
          <input name="document" type="file" accept="application/pdf" required />
        </label>
        <button disabled={busy} className="justify-self-start rounded-full bg-emerald-800 px-5 py-2 font-bold text-white">Upload document</button>
      </form>
      {status && <p role="status">{status}</p>}
    </main>
  );
}
