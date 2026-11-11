'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';

export default function SellerRegisterPage() {
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus('');
    try {
      const response = await fetch('/api/sellers', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))),
      });
      const result = await response.json();
      setStatus(response.ok ? 'Store details saved.' : response.status === 401 ? 'Sign in to submit your store details.' : result.error);
    } catch {
      setStatus('Unable to submit your application.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-8">
      <div className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
        <div className="rounded-[30px] bg-gradient-to-br from-[#0c5c36] to-[#073c22] p-7 text-white shadow-soft">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-emerald-100">Seller Centre</p>
          <h1 className="mt-3 text-3xl font-black md:text-5xl">Open your store and start selling today.</h1>
          <p className="mt-4 text-sm leading-7 text-emerald-100/80">Build a premium storefront, connect with shoppers and manage orders from a single dashboard.</p>
          <div className="mt-6 space-y-3 text-sm text-emerald-50">
            <div>• Verified seller onboarding</div>
            <div>• Inventory and fulfilment management</div>
            <div>• Live shopping and flash deals tools</div>
          </div>
        </div>

        <form onSubmit={submit} className="rounded-[30px] border border-slate-100 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-black text-slate-900">Create seller account</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium text-slate-700"><span className="mb-2 block">Business name</span><input className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 outline-none focus:border-emerald-600" placeholder="Your brand" name="businessName" required minLength={2} maxLength={120} /></label>
            <label className="text-sm font-medium text-slate-700"><span className="mb-2 block">Storefront name</span><input className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 outline-none focus:border-emerald-600" placeholder="Store name" name="storefrontName" required minLength={2} maxLength={120} /></label>
            <label className="sm:col-span-2 text-sm font-medium text-slate-700"><span className="mb-2 block">Location</span><input className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 outline-none focus:border-emerald-600" placeholder="Lagos, Nigeria" name="location" required minLength={2} maxLength={120} /></label>
            <label className="sm:col-span-2 text-sm font-medium text-slate-700"><span className="mb-2 block">Store description</span><textarea name="storeDescription" maxLength={1000} className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3" /></label>
          </div>
          <button disabled={busy} className="mt-6 w-full rounded-full bg-emerald-800 px-5 py-3 text-sm font-black text-white hover:bg-emerald-900">Save store details</button>
          <p role="status" className="mt-3 text-sm">{status}</p>
          <Link href="/profile" className="text-sm font-bold text-emerald-800">Sign in or create an account</Link>
          <Link href="/seller/kyc" className="ml-3 text-sm font-bold text-emerald-800">Upload verification document</Link>
          <p className="mt-4 text-xs text-slate-500">By continuing, you agree to the Seller Agreement and policy terms.</p>
        </form>
      </div>
    </div>
  );
}
