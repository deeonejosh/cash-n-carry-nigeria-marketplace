import Link from 'next/link';
import PaymentStatus from './PaymentStatus';

export default async function CheckoutComplete({ searchParams: input }: { searchParams: Promise<{ reference?: string; tx_ref?: string }> }) {
  const searchParams = await input;
  const reference = searchParams.reference ?? searchParams.tx_ref;
  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <section className="rounded-[28px] border border-slate-100 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-black">Payment status</h1>
        <PaymentStatus reference={typeof reference === 'string' ? reference : ''} />
        <Link className="mt-4 inline-block font-bold text-emerald-800" href="/shop">Back to shop</Link>
      </section>
    </main>
  );
}
