import Image from 'next/image';
import Link from 'next/link';
import { currency, Product } from '@/lib/data';

export default function ProductCard({ product }: { product: Product }) {
  return (
    <article className="group overflow-hidden rounded-[22px] border border-slate-100 bg-white p-2.5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
      <div className="relative overflow-hidden rounded-2xl bg-slate-50">
        <div className="absolute left-2 top-2 z-10 rounded-md bg-orange-500 px-1.5 py-1 text-[9px] font-black text-white">{product.badge ?? 'New'}</div>
        <div className="absolute right-2 top-2 z-10 rounded-full bg-white/90 p-1.5 text-slate-600 shadow-sm">
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current"><path d="M12 21s-8.5-5.2-10.4-9.8C.6 8.7 2.7 4 7.1 4c2.2 0 3.7 1.3 4.1 2.1.4-.8 1.9-2.1 4.1-2.1 4.4 0 6.5 4.7 5.5 7.2C20.5 15.8 12 21 12 21Z" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
        <div className="relative h-52 w-full">
          {product.image && <Image src={product.image} alt={product.title} fill className="object-cover transition duration-500 group-hover:scale-105" />}
        </div>
      </div>
      <div className="pt-3">
        <p className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">{product.brand}</p>
        <Link href={`/products/${product.slug}`} className="mt-1 block text-sm font-bold leading-snug text-slate-900 hover:text-emerald-800">{product.title}</Link>
        <div className="mt-2 flex items-center gap-1 text-[11px] text-amber-500">
          <span>★</span>
          <span>{product.rating}</span>
          <span className="text-slate-400">({product.reviews})</span>
        </div>
        <div className="mt-3 flex items-end justify-between gap-2">
          <div>
            <div className="text-base font-black text-slate-900">{currency(product.price)}</div>
            {product.compareAt > product.price && <div className="text-[10px] text-slate-400 line-through">{currency(product.compareAt)}</div>}
          </div>
          <Link href={`/products/${product.slug}`} className="rounded-full bg-emerald-800 px-3.5 py-2 text-[10px] font-extrabold text-white transition hover:bg-emerald-900">Buy now</Link>
        </div>
      </div>
    </article>
  );
}
