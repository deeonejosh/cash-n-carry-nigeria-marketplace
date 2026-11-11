import type { Metadata, Viewport } from 'next';
import './globals.css';
import MobileNav from '@/components/ui/MobileNav';

export const metadata: Metadata = {
  title: 'Cash N Carry | Shop, discover and watch live',
  description: 'Discover trusted Nigerian sellers, shop popular products and enjoy live shopping on Cash N Carry.',
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = { themeColor: '#0c5c36' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className="pb-16 md:pb-0">{children}<MobileNav /></body></html>;
}
