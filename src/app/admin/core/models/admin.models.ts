import type { AdminRole } from './permission.model';

/** Usuario tal como lo devuelve el backend (`user.model.js`). */
export interface AdminUser {
  _id: string;
  name: string;
  nickname: string;
  email: string;
  role: AdminRole;
  status: boolean;
  avatar?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** Categoría (`category.model.js`). */
export interface AdminCategory {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/** Imagen de producto (`product.model.js` -> images[]). */
export interface ProductImage {
  url: string;
  isMain?: boolean;
}

/** Producto (`product.model.js`). `category` llega como id o poblado. */
export interface AdminProduct {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  price: number;
  stock: number;
  images: ProductImage[];
  category: string | AdminCategory | null;
  isActive: boolean;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** Rol servido por `GET /roles` -> `{ id, name }`. */
export interface RoleOption {
  id: AdminRole;
  name: string;
}

/** Envoltura estándar de las respuestas del backend: `{ msg, data }`. */
export interface ApiEnvelope<T> {
  msg: string;
  data: T;
  token?: string;
}

/** Item de carrito administrativo (`cart.model.js`). */
export interface AdminCartItem {
  productId: string | AdminProduct;
  quantity: number;
}
export interface AdminCart {
  _id: string;
  userId: string | AdminUser;
  items: AdminCartItem[];
  createdAt?: string;
  updatedAt?: string;
}

export type LoadState = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

export const STOCK_LOW_THRESHOLD = 5;

export type StockLevel = 'ok' | 'low' | 'out';
export function stockLevel(stock: number, threshold = STOCK_LOW_THRESHOLD): StockLevel {
  if (stock <= 0) return 'out';
  if (stock <= threshold) return 'low';
  return 'ok';
}

/** URL de la imagen principal de un producto (o la primera, o null). */
export function mainImageUrl(images: ProductImage[] | undefined): string | null {
  if (!images?.length) return null;
  return (images.find((img) => img.isMain) ?? images[0]).url || null;
}

/** `category` puede llegar como id (string) o poblado (objeto). Devuelve el id. */
export function categoryId(category: AdminProduct['category']): string | null {
  if (!category) return null;
  return typeof category === 'string' ? category : category._id;
}
