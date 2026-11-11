export type Category = {
  id: string;
  name: string;
  slug: string;
  count: number;
  accent: string;
  icon: string;
};

export type Product = {
  id: string;
  slug: string;
  title: string;
  brand: string;
  price: number;
  compareAt: number;
  rating: number;
  reviews: number;
  image: string;
  category: string;
  badge?: string;
  featured?: boolean;
  description: string;
};

export type Seller = {
  id: string;
  slug: string;
  name: string;
  location: string;
  rating: number;
  sold: number;
  avatar: string;
  focus: string;
};

export const categories: Category[] = [
  { id: 'fashion', name: 'Fashion', slug: 'fashion', count: 120, accent: 'from-rose-500 to-pink-500', icon: '👗' },
  { id: 'beauty', name: 'Beauty', slug: 'beauty', count: 85, accent: 'from-pink-500 to-violet-500', icon: '🌸' },
  { id: 'food', name: 'Food', slug: 'food', count: 210, accent: 'from-yellow-400 to-orange-500', icon: '🥐' },
  { id: 'tech', name: 'Tech', slug: 'tech', count: 95, accent: 'from-sky-400 to-blue-500', icon: '📱' },
  { id: 'home', name: 'Home', slug: 'home', count: 64, accent: 'from-amber-800 to-stone-700', icon: '🏡' },
  { id: 'services', name: 'Services', slug: 'services', count: 40, accent: 'from-indigo-500 to-violet-600', icon: '✨' },
];

export const sellers: Seller[] = [
  { id: 'olaoluwa', slug: 'olaoluwa-trends', name: 'Olaoluwa Trends', location: 'Lagos', rating: 4.9, sold: 1200, avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=500&auto=format&fit=crop&q=80', focus: 'Fashion & lifestyle' },
  { id: 'ziva', slug: 'ziva-glow', name: 'Ziva Glow Essentials', location: 'Abuja', rating: 4.8, sold: 850, avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=500&auto=format&fit=crop&q=80', focus: 'Beauty essentials' },
  { id: 'mile12', slug: 'mile12-fresh-market', name: 'Mile 12 Fresh Market', location: 'Lagos', rating: 4.7, sold: 2100, avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=500&auto=format&fit=crop&q=80', focus: 'Groceries & pantry' },
  { id: 'wearables', slug: 'wearables-ng', name: 'Wearables NG', location: 'Port Harcourt', rating: 4.6, sold: 960, avatar: 'https://images.unsplash.com/photo-1556157382-97eda2d62296?w=500&auto=format&fit=crop&q=80', focus: 'Tech & devices' },
];

export const products: Product[] = [
  { id: 'p1', slug: 'studio-wireless-headphones', title: 'Gaming Headset with Microphone', brand: 'Audio Technica', price: 18500, compareAt: 23000, rating: 4.8, reviews: 124, image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80', category: 'tech', badge: '20% OFF', description: 'Immersive sound, deep bass and clear team communication for games and work.' },
  { id: 'p2', slug: 'adjustable-phone-tripod', title: 'Phone Tripod Stand', brand: 'Gadget House NG', price: 8500, compareAt: 10000, rating: 4.7, reviews: 92, image: 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=800&auto=format&fit=crop&q=80', category: 'tech', badge: '15% OFF', description: 'Stable support for content creation, video calls and hands-free viewing.' },
  { id: 'p3', slug: 'wireless-bluetooth-earbuds', title: 'Wireless Bluetooth Earbuds', brand: 'Soundcore Lagos', price: 14500, compareAt: 19000, rating: 4.9, reviews: 201, image: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=800&auto=format&fit=crop&q=80', category: 'tech', badge: '25% OFF', description: 'Compact and comfortable earbuds with deep sound and long battery life.' },
  { id: 'p4', slug: 'smart-fitness-watch', title: 'Smart Fitness Watch', brand: 'Wearables NG', price: 32500, compareAt: 36000, rating: 4.6, reviews: 88, image: 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=800&auto=format&fit=crop&q=80', category: 'tech', badge: '10% OFF', description: 'Track your steps, workouts and sleep with this sleek daily companion.' },
  { id: 'p5', slug: 'elegant-ankara-print-dress', title: 'Elegant Ankara Print Dress', brand: 'Olaoluwa Trends', price: 16250, compareAt: 22000, rating: 4.8, reviews: 176, image: 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=800&auto=format&fit=crop&q=80', category: 'fashion', badge: 'New', description: 'Bold Nigerian-inspired design with premium fabric and a flattering fit.' },
  { id: 'p6', slug: 'gold-collection-essentials', title: 'Glow Gold Skincare Set', brand: 'Ziva Glow Essentials', price: 9800, compareAt: 12000, rating: 4.9, reviews: 142, image: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=800&auto=format&fit=crop&q=80', category: 'beauty', badge: 'Best seller', description: 'A daily hydrating set with vitamin-based care and a radiant glow.' },
  { id: 'p7', slug: 'premium-cleaning-bundle', title: 'Premium Cleaning Bundle', brand: 'Mile 12 Fresh Market', price: 12450, compareAt: 15800, rating: 4.7, reviews: 76, image: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=800&auto=format&fit=crop&q=80', category: 'home', badge: 'Home edit', description: 'All-in-one home essentials bundle for a cleaner and fresher space.' },
  { id: 'p8', slug: 'organic-basket', title: 'Organic Grocery Basket', brand: 'Fresh Basket NG', price: 21400, compareAt: 26000, rating: 4.8, reviews: 98, image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&auto=format&fit=crop&q=80', category: 'food', badge: 'Fresh', description: 'Healthy staples and produce carefully selected for your family table.' },
];

export const videos = [
  { id: 'v1', title: 'Luxury kitchen essentials drop', creator: 'Mile 12 Fresh', views: '120K', likes: '13.4K', comments: 502, thumbnail: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=800&auto=format&fit=crop&q=80' },
  { id: 'v2', title: 'Street style layering for work', creator: 'Olaoluwa Trends', views: '96K', likes: '9.8K', comments: 311, thumbnail: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800&auto=format&fit=crop&q=80' },
  { id: 'v3', title: 'Skincare routine under 10 minutes', creator: 'Ziva Glow', views: '140K', likes: '17.2K', comments: 645, thumbnail: 'https://images.unsplash.com/photo-1515377905703-c4788e51af15?w=800&auto=format&fit=crop&q=80' },
];

export const heroStats = [
  { label: 'Happy shoppers', value: '1.2M+' },
  { label: 'Verified sellers', value: '12k+' },
  { label: 'Delivery coverage', value: '36 states' },
];

export const marketplaceTabs = ['For You', 'Shop', 'Fashion', 'Beauty', 'Home & Kitchen', 'Electronics', 'Food & Grocery', 'Live shopping', 'Sell with us'];

export const currency = (value: number) => `₦${value.toLocaleString('en-NG')}`;

export const findProductBySlug = (slug: string) => products.find((product) => product.slug === slug) ?? products[0];

export const findSellerBySlug = (slug: string) => sellers.find((seller) => seller.slug === slug) ?? sellers[0];

export const defaultSellerCopy = `A premium seller storefront for trusted products, live drops and customer support.`;

export const navLinks = [
  { label: 'For You', href: '/' },
  { label: 'Shop', href: '/shop' },
  { label: 'Messages', href: '/messages' },
  { label: 'Profile', href: '/profile' },
];

export const adminCards = [
  { title: 'Users', value: '18.2K', note: '+8.4% this month' },
  { title: 'Orders', value: '7,864', note: '3.2% weekly growth' },
  { title: 'Revenue', value: '₦41.9M', note: 'Gross sales' },
  { title: 'Refunds', value: '1.8%', note: 'Lower than target' },
];

export const verificationQueue = [
  'Ziva Glow Essentials',
  'Mile 12 Fresh Market',
  'Aisha Homecare Studio',
  'Nova Gadgets',
];
