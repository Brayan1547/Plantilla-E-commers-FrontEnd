/**
 * F7 — Publication + Storefront.
 *
 * Contrato PÚBLICO real de Product/Category (`PUBLIC_PRODUCT_FIELDS` /
 * `dbGetPublicCategories` en el backend, `product.services.js` /
 * `category.service.js`). Interfaces MÍNIMAS para los datos que el
 * storefront consume hoy — no es un tipado exhaustivo de todo el dominio
 * (eso vive en `admin/core/models/admin.models.ts` para el panel, que ve el
 * contrato editorial completo). `status`, `createdBy`, `workflowHistory`,
 * `stockOps` y el resto de metadata editorial NUNCA llegan a esta forma: el
 * backend ni siquiera los selecciona en la proyección pública.
 */

/** Imagen pública de producto — igual que `admin.models.ts` menos `publicId` (nunca sale del backend). */
export interface PublicProductImage {
  url: string;
  isMain?: boolean;
  type?: 'MAIN' | 'MODEL' | 'DETAIL';
  order?: number;
  alt?: string;
}

/**
 * Variante pública — F7-A/F7-F: SOLO `color/size/stock`. `sku` es dato
 * interno de inventario y el backend lo excluye explícitamente de
 * `PUBLIC_PRODUCT_FIELDS` (proyección por subcampo, no por documento
 * completo) — por eso ni siquiera aparece aquí como campo opcional.
 */
export interface PublicProductVariant {
  _id?: string;
  color: string;
  size: string;
  stock: number;
}

/** Categoría poblada en la respuesta pública de Product (`{_id, name, slug}`, ver F7-A). */
export interface PublicProductCategory {
  _id: string;
  name: string;
  slug: string;
}

/** `modelInfo` público — `heightCm` SIEMPRE en centímetros (ver F1/F3, sin cambios en F7). */
export interface PublicModelInfo {
  size?: string;
  heightCm?: number | null;
}

/** Producto tal como lo devuelve `GET /api/product` / `GET /api/product/:id` público (sin sesión, o sin rol admin-capable). */
export interface PublicProduct {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  details?: string;
  shippingInfo?: string;
  returnsInfo?: string;
  modelInfo?: PublicModelInfo;
  price: number;
  images: PublicProductImage[];
  categories: PublicProductCategory[];
  /** Agregado — `Σ variants[].stock` cuando el producto tiene variantes (F5, sin cambios). */
  stock: number;
  isActive: boolean;
  /** F7-A — única fecha con sentido de "recién llegado"; NUNCA `createdAt`/`updatedAt` (ver home.ts). */
  publishedAt?: string;
  variants: PublicProductVariant[];
}

/** Categoría tal como la devuelve `GET /api/category` público (F7-C: solo activas fuera de sesión admin-capable). */
export interface PublicCategory {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  isActive: boolean;
}
