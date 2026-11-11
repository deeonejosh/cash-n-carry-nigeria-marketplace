import Link from 'next/link';
import { Heart, Search, ShoppingBag, Bell, UserRound, ChevronDown } from 'lucide-react';

export default function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 md:px-8">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-800 text-orange-400 shadow-sm"><ShoppingBag className="h-5 w-5" /></span>
          <span className="text-lg font-black tracking-tight text-emerald-950">Cash <span className="text-orange-500">N</span> Carry</span>
        </Link>

        <button className="hidden items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 lg:flex">
          Shop by category <ChevronDown className="h-4 w-4" />
        </button>

        <label className="relative mx-auto hidden flex-1 max-w-2xl lg:block">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input placeholder="Search products, brands and stores" className="h-11 w-full rounded-full border border-slate-200 bg-slate-50 pl-11 pr-24 text-sm outline-none focus:border-emerald-600 focus:bg-white focus:ring-4 focus:ring-emerald-600/10" />
          <button className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full bg-emerald-800 px-4 py-2 text-xs font-bold text-white">Search</button>
        </label>

        <div className="hidden items-center gap-1 sm:flex">
          <button className="rounded-full p-2.5 hover:bg-slate-100" aria-label="Wishlist"><Heart className="h-5 w-5 text-slate-700" /></button>
          <button className="rounded-full p-2.5 hover:bg-slate-100" aria-label="Notifications"><Bell className="h-5 w-5 text-slate-700" /></button>
          <Link href="/profile" className="rounded-full p-2.5 hover:bg-slate-100" aria-label="Profile"><UserRound className="h-5 w-5 text-slate-700" /></Link>
          <Link href="/cart" className="ml-2 flex items-center gap-2 rounded-full bg-emerald-800 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-900">
            <ShoppingBag className="h-4 w-4" /> Cart (0)
          </Link>
        </div>
      </div>

      <nav className="mx-auto hidden max-w-7xl items-center gap-7 px-8 pb-3 text-[13px] font-semibold text-slate-600 md:flex">
        {['For You', 'Shop', 'Fashion', 'Beauty', 'Home & Kitchen', 'Electronics', 'Food & Grocery', 'Live shopping', 'Sell with us'].map((item) => (
          <Link key={item} href={item === 'Sell with us' ? '/seller/register' : item === 'Shop' ? '/shop' : '/'} className="whitespace-nowrap transition hover:text-emerald-800">{item}</Link>
        ))}
      </nav>
    </header>
  );
}
