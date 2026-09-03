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

/** Variante de producto (`product.model.js` -> variants[], subdocumentos embebidos). */
export interface ProductVariant {
  _id?: string;
  sku: string;
  color: string;
  /** Vacío = "sin talla" (p. ej. accesorios). */
  size?: string;
  stock: number;
}

/**
 * Ciclo de vida editorial (workflow). SEPARADO de `isActive` (activación
 * operacional) — ver Product Domain Design Proposal §8. El backend es la
 * única autoridad real de las transiciones; este enum solo describe la UI.
 */
export const PRODUCT_STATUSES = [
  'DRAFT',
  'PENDING_REVIEW',
  'APPROVED',
  'REJECTED',
  'PUBLISHED',
] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  DRAFT: 'Borrador',
  PENDING_REVIEW: 'En revisión',
  APPROVED: 'Aprobado',
  REJECTED: 'Rechazado',
  PUBLISHED: 'Publicado',
};

export const PRODUCT_STATUS_TONE: Record<ProductStatus, 'ok' | 'warn' | 'danger' | 'info' | 'neutral'> = {
  DRAFT: 'neutral',
  PENDING_REVIEW: 'info',
  APPROVED: 'warn',
  REJECTED: 'danger',
  PUBLISHED: 'ok',
};

/** Estados en los que el contenido admite edición directa (DRAFT/REJECTED). Ver `editableFieldsFor` en el backend. */
export function isContentEditableStatus(status: ProductStatus): boolean {
  return status === 'DRAFT' || status === 'REJECTED';
}

/** Producto (`product.model.js`). `categories` llega como ids o poblados. */
export interface AdminProduct {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  price: number;
  stock: number;
  images: ProductImage[];
  categories: (string | AdminCategory)[];
  variants: ProductVariant[];
  status: ProductStatus;
  isActive: boolean;
  rejectionReason?: string;
  createdBy?: string;
  updatedBy?: string;
  submittedBy?: string;
  submittedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  publishedBy?: string;
  publishedAt?: string;
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
  /** Solo en el 400 de `PATCH /product/:id/status` -> PENDING_REVIEW con datos incompletos. */
  errors?: string[];
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

/** `categories` puede traer ids (string) u objetos poblados. Devuelve los ids. */
export function categoryIds(categories: AdminProduct['categories'] | undefined): string[] {
  if (!categories?.length) return [];
  return categories.map((c) => (typeof c === 'string' ? c : c._id)).filter(Boolean);
}

/** Nombres de categoría para mostrar (usa el mapa id->nombre del listado). */
export function categoryNames(
  categories: AdminProduct['categories'] | undefined,
  nameById: Map<string, string>,
): string[] {
  return categoryIds(categories)
    .map((id) => nameById.get(id))
    .filter((n): n is string => !!n);
}
