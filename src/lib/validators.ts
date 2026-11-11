import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['BUYER', 'SELLER', 'ADMIN']).default('BUYER'),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const createProductSchema = z.object({
  title: z.string().trim().min(3).max(150),
  description: z.string().trim().min(12).max(5000),
  price: z.number().positive().max(9999999999.99),
  compareAtPrice: z.number().positive().optional(),
  stock: z.number().int().min(0).max(1000000).default(0),
  categoryId: z.string().optional(),
  imageUrl: z.string().url().optional(),
  images: z.array(z.string().url()).optional(),
  slug: z.string().min(3).optional(),
});

export const createOrderSchema = z.object({
  checkoutKey: z.string().uuid().optional(),
  shippingAddress: z.string().trim().min(8).max(1000),
  items: z.array(z.object({
    productId: z.string(),
    quantity: z.number().int().min(1).max(99),
  })).min(1).max(100),
});

export const createMessageSchema = z.object({
  threadId: z.string().optional(),
  receiverId: z.string().optional(),
  text: z.string().trim().min(1).max(2000),
});
