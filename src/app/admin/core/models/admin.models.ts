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

/** Tipo/encuadre de imagen (`product.model.js` -> PRODUCT_IMAGE_TYPES). */
export const PRODUCT_IMAGE_TYPES = ['MAIN', 'MODEL', 'DETAIL'] as const;
export type ProductImageType = (typeof PRODUCT_IMAGE_TYPES)[number];

export const PRODUCT_IMAGE_TYPE_LABELS: Record<ProductImageType, string> = {
  MAIN: 'Principal / catálogo',
  MODEL: 'Con modelo',
  DETAIL: 'Detalle',
};

/**
 * Imagen de producto (`product.model.js` -> images[]).
 *
 * FASE 1 del backend añadió `type` / `order` / `alt`. `_id` lo genera Mongoose.
 * La imagen principal es SIEMPRE la única con `isMain: true` y su `type` queda
 * sincronizado a `'MAIN'` por `normalizeProductImages` en el backend — la UI
 * solo tiene que evitar mostrar dos "principales" a la vez (el backend
 * normaliza igual al guardar). Ver F3 §7.
 */
export interface ProductImage {
  _id?: string;
  url: string;
  isMain?: boolean;
  type?: ProductImageType;
  /** Orden de presentación (0-based). El backend NO lo reordena. */
  order?: number;
  alt?: string;
}

/** Variante de producto (`product.model.js` -> variants[], subdocumentos embebidos). */
export interface ProductVariant {
  _id?: string;
  sku: string;
  color: string;
  /**
   * F5-CLOSURE — obligatoria para toda variante nueva/actualizada (el backend
   * la exige). Productos sin tallaje (accesorios) usan literalmente "Única",
   * nunca una cadena vacía. Sigue opcional en el TIPO solo porque un
   * documento LEGACY ya persistido puede devolver "" o ausente desde el GET
   * (nunca migrado automáticamente) — ver F5-CLOSURE report §Productos legacy.
   */
  size?: string;
  stock: number;
}

/**
 * Información del modelo (`product.model.js` -> modelInfo).
 * `heightCm` SIEMPRE numérico y en centímetros — la presentación "1.87 m" es
 * responsabilidad de la UI (`formatHeightCm`). Ver F3 §6.
 */
export interface ModelInfo {
  size?: string;
  heightCm?: number | null;
}

/** "1.87 m" a partir de centímetros; '' si no hay dato. */
export function formatHeightCm(cm: number | null | undefined): string {
  if (cm == null || !Number.isFinite(cm) || cm <= 0) return '';
  return `${(cm / 100).toFixed(2)} m`;
}

/**
 * Ciclo de vida editorial (workflow). SEPARADO de `isActive` (activación
 * operacional) — ver Product Domain Design Proposal §8. El backend es la
 * única autoridad real de las transiciones; este enum solo describe la UI.
 */
export const PRODUCT_STATUSES = [
  'DRAFT',
  'PENDING_REVIEW',
  'CHANGES_REQUESTED',
  'APPROVED',
  'REJECTED',
  'PUBLISHED',
  'ARCHIVED',
] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  DRAFT: 'Borrador',
  PENDING_REVIEW: 'En revisión',
  CHANGES_REQUESTED: 'Cambios solicitados',
  APPROVED: 'Aprobado',
  REJECTED: 'Rechazado',
  PUBLISHED: 'Publicado',
  ARCHIVED: 'Archivado',
};

export const PRODUCT_STATUS_TONE: Record<ProductStatus, 'ok' | 'warn' | 'danger' | 'info' | 'neutral'> = {
  DRAFT: 'neutral',
  PENDING_REVIEW: 'info',
  CHANGES_REQUESTED: 'warn',
  APPROVED: 'warn',
  REJECTED: 'danger',
  PUBLISHED: 'ok',
  ARCHIVED: 'neutral',
};

/**
 * Estados en los que el contenido admite edición directa por el propietario:
 * DRAFT / REJECTED / CHANGES_REQUESTED (espejo de `CONTENT_UNLOCKED_STATUSES`
 * del backend). El backend sigue siendo la autoridad — esto solo decide qué
 * habilita la UI.
 */
export function isContentEditableStatus(status: ProductStatus): boolean {
  return status === 'DRAFT' || status === 'REJECTED' || status === 'CHANGES_REQUESTED';
}

/**
 * F6 — `createdBy` y `workflowHistory[].by` llegan POBLADOS (`{ _id, name,
 * nickname }`) en la respuesta EDITORIAL (`GET /product?all=true`, `GET
 * /product/:id` para un rol admin-capable — ver `populateReviewActors` en el
 * backend). Sigue siendo un string plano en cualquier lectura que NO pase por
 * ese populate (p. ej. un documento guardado antes de F6, o si el backend
 * cambiara de estrategia) — de ahí la unión de tipos; usa `actorName()` para
 * leerlo sin importar la forma.
 */
export interface ProductActorRef {
  _id: string;
  name: string;
  nickname?: string;
}
export type ProductActor = string | ProductActorRef;

/** Nombre a mostrar de un actor (`createdBy` / `workflowHistory[].by`), sea populado o un ObjectId crudo. */
export function actorName(actor: ProductActor | undefined | null): string | null {
  if (!actor) return null;
  return typeof actor === 'string' ? null : actor.name || null;
}

/**
 * Entrada del historial de workflow (`product.model.js` -> workflowHistory[]).
 * Append-only, la escribe SOLO el backend en cada transición de estado.
 */
export interface WorkflowHistoryEntry {
  action: string;
  fromStatus?: ProductStatus;
  toStatus: ProductStatus;
  by?: ProductActor;
  at?: string;
  comment?: string;
}

export const WORKFLOW_ACTION_LABELS: Record<string, string> = {
  submit: 'Enviado a revisión',
  resubmit: 'Reenviado a revisión',
  request_changes: 'Cambios solicitados',
  approve: 'Aprobado',
  reject: 'Rechazado',
  publish: 'Publicado',
  archive: 'Archivado',
  reopen: 'Devuelto a borrador',
};

export function workflowActionLabel(action: string): string {
  return WORKFLOW_ACTION_LABELS[action] ?? action;
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
  // FASE 1 del backend — contenido editorial nuevo.
  details?: string;
  shippingInfo?: string;
  returnsInfo?: string;
  modelInfo?: ModelInfo;
  workflowHistory?: WorkflowHistoryEntry[];
  createdBy?: ProductActor;
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

/**
 * Comentario de revisión más reciente relevante para el editor: el `comment`
 * de la última entrada `request_changes` o `reject` del historial. Cae a
 * `rejectionReason` (espejo de compat del backend) si el historial no lo trae.
 * `null` si no hay ninguno.
 */
export function lastReviewComment(product: Pick<AdminProduct, 'workflowHistory' | 'rejectionReason'>): string | null {
  const history = product.workflowHistory ?? [];
  for (let i = history.length - 1; i >= 0; i--) {
    const e = history[i];
    if ((e.action === 'request_changes' || e.action === 'reject') && e.comment?.trim()) {
      return e.comment.trim();
    }
  }
  return product.rejectionReason?.trim() || null;
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
