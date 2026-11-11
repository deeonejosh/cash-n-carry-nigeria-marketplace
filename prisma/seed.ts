import { PrismaClient, Role, SellerStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';

const prisma = new PrismaClient();

const categories = [
  { name: 'Fashion', slug: 'fashion' },
  { name: 'Beauty', slug: 'beauty' },
  { name: 'Food', slug: 'food' },
  { name: 'Tech', slug: 'tech' },
  { name: 'Home', slug: 'home' },
  { name: 'Services', slug: 'services' },
];

const sellers = [
  {
    id: 'seller-1',
    email: 'olaoluwa@cashncarry.ng',
    name: 'Olaoluwa Trends',
    businessName: 'Olaoluwa Trends',
    storefrontName: 'Olaoluwa Trends',
    location: 'Lagos',
    status: SellerStatus.VERIFIED,
    role: 'SELLER',
  },
  {
    id: 'seller-2',
    email: 'ziva@cashncarry.ng',
    name: 'Ziva Glow Essentials',
    businessName: 'Ziva Glow Essentials',
    storefrontName: 'Ziva Glow',
    location: 'Abuja',
    status: SellerStatus.VERIFIED,
    role: 'SELLER',
  },
];

const products = [
  {
    title: 'Gaming Headset with Microphone',
    slug: 'gaming-headset-with-microphone',
    description: 'Immersive sound and microphone for gaming and work.',
    price: 18500,
    compareAtPrice: 23000,
    stock: 42,
    imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e',
    category: 'tech',
  },
  {
    title: 'Phone Tripod Stand',
    slug: 'phone-tripod-stand',
    description: 'Stable support for content creators and video calls.',
    price: 8500,
    compareAtPrice: 10000,
    stock: 65,
    imageUrl: 'https://images.unsplash.com/photo-1598327105666-5b89351aff97',
    category: 'tech',
  },
  {
    title: 'Elegant Ankara Print Dress',
    slug: 'elegant-ankara-print-dress',
    description: 'Premium print dress with a flattering fit for events and work.',
    price: 16250,
    compareAtPrice: 22000,
    stock: 18,
    imageUrl: 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b',
    category: 'fashion',
  },
  {
    title: 'Glow Gold Skincare Set',
    slug: 'glow-gold-skincare-set',
    description: 'Hydrating and brightening skincare duo for everyday radiance.',
    price: 9800,
    compareAtPrice: 12000,
    stock: 87,
    imageUrl: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9',
    category: 'beauty',
  },
];

async function main() {
  const database = new URL(process.env.DATABASE_URL ?? '');
  if (!['localhost', '127.0.0.1', '[::1]'].includes(database.hostname) ||
      !/_(dev|test)$/.test(database.pathname)) {
    throw new Error('Seed requires a local database ending in _dev or _test');
  }
  if (await prisma.user.count() || await prisma.category.count()) {
    throw new Error('Seed requires an empty development database');
  }

  for (const category of categories) {
    await prisma.category.create({ data: category });
  }

  for (const seller of sellers) {
    const user = await prisma.user.create({
      data: {
        email: seller.email,
        name: seller.name,
        passwordHash: await bcrypt.hash(randomBytes(32).toString('hex'), 12),
        role: Role.SELLER,
      },
    });

    const sellerProfile = await prisma.sellerProfile.create({
      data: {
        userId: user.id,
        businessName: seller.businessName,
        storefrontName: seller.storefrontName,
        location: seller.location,
        status: seller.status,
        storeDescription: 'Premium storefront for local shopping and community commerce.',
      },
    });

    await prisma.sellerKyc.create({
      data: {
        userId: user.id,
        sellerId: sellerProfile.id,
        status: 'APPROVED',
        documentType: 'business-license',
        documentUrl: 'https://example.com/document.pdf',
        submittedAt: new Date(),
        approvedAt: new Date(),
      },
    });
  }

  const sellerProfiles = await prisma.sellerProfile.findMany();
  const categoryMap = await prisma.category.findMany();

  for (const product of products) {
    const seller = sellerProfiles[Math.floor(Math.random() * sellerProfiles.length)];
    const category = categoryMap.find((item) => item.slug === product.category) ?? categoryMap[0];

    await prisma.product.create({
      data: {
        sellerId: seller.id,
        categoryId: category.id,
        title: product.title,
        slug: product.slug,
        description: product.description,
        price: product.price,
        compareAtPrice: product.compareAtPrice,
        stock: product.stock,
        imageUrl: product.imageUrl,
        images: JSON.stringify([product.imageUrl]),
        published: true,
        featured: product.slug.includes('headset') || product.slug.includes('dress'),
      },
    });
  }

  const admin = await prisma.user.create({
    data: {
      email: 'admin@cashncarry.ng',
      name: 'Cash N Carry Admin',
      passwordHash: await bcrypt.hash(randomBytes(32).toString('hex'), 12),
      role: Role.ADMIN,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      type: 'LOGIN',
      message: 'Initialization complete',
      metadata: JSON.stringify({ source: 'seed' }),
    },
  });

  console.log('Seed complete');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
