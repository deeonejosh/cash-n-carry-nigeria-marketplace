'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShoppingBag, Stars, MessageCircle, UserRound } from 'lucide-react';

const tabs = [
  { label: 'For You', href: '/', icon: <Stars className="h-4 w-4" /> },
  { label: 'Shop', href: '/shop', icon: <ShoppingBag className="h-4 w-4" /> },
  { label: '+', href: '/videos/upload', icon: <span className="text-xl leading-none">+</span> },
  { label: 'Messages', href: '/messages', icon: <MessageCircle className="h-4 w-4" /> },
  { label: 'Profile', href: '/profile', icon: <UserRound className="h-4 w-4" /> },
];

export default function MobileNav() {
  if (usePathname() === '/') return null;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 md:hidden">
      <div className="mx-auto grid max-w-md grid-cols-5 items-center gap-1 px-2 text-[10px] font-semibold text-slate-600">
        {tabs.map((tab) => (
          <Link key={tab.label} href={tab.href} className="flex flex-col items-center gap-1 rounded-xl px-2 py-2 transition hover:bg-slate-50 hover:text-emerald-800">
            <span className="flex h-5 w-5 items-center justify-center">{tab.icon}</span>
            {tab.label !== '+' && <span>{tab.label}</span>}
          </Link>
        ))}
      </div>
    </nav>
  );
}
