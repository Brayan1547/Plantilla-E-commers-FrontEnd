import type { BadgeTone } from '../../shared/ui/status-badge/status-badge';

/**
 * UI-5.2 — Tipos del panel para el dominio Order.
 *
 * Espejo EXACTO del contrato real del backend (auditado en UI-5.0 / UI-5.1):
 *   GET   /api/orders            -> { msg, data: { items: AdminOrderListItem[], pagination } }
 *   GET   /api/orders/:id        -> { msg, data: AdminOrderDetail }
 *   PATCH /api/orders/:id/status -> { msg, data: AdminOrderDetail }
 *   PATCH /api/orders/:id/payment-> { msg, data: AdminOrderDetail }
 *   Auth de las 4: x-token + rol administrador|shop_manager
 *     (`order.routes.js` -> autenticationUser + authorizationUser).
 *
 * NO se declara aquí nada que el backend no exponga. En particular:
 *   · `payment.paidAt` / `payment.note` SE PERSISTEN en el backend (UI-5.1) pero
 *     `toAdminOrderDetail` NO los proyecta todavía -> no se tipan aquí.
 *   · `items[]` NO lleva variante/talla/color: en F4 la tienda solo vende
 *     productos SIN variantes (BLOCKER-01), así que una orden nunca tiene esa
 *     información. No es un dato ausente "a arreglar", es el diseño del dominio.
 *   · `totals` no tiene descuentos: F4 no tiene sistema de cupones.
 *
 * El backend es la ÚNICA autoridad de transiciones. Los mapas de este archivo
 * (`ORDER_STATUS_FLOW`, `PAYMENT_FLOW`) solo deciden qué BOTONES ofrece la UI;
 * si quedan desincronizados, el backend responde 409/422 y la vista recarga.
 */

// --- Estados del pedido (order.status) --------------------------------------

export const ORDER_STATUSES = [
  'pending_confirmation',
  'confirmed',
  'ready_to_ship',
  'shipped',
  'delivered',
  'cancelled',
  'failed_delivery',
  'returned',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending_confirmation: 'Pendiente de confirmación',
  confirmed: 'Confirmado',
  ready_to_ship: 'Listo para envío',
  shipped: 'Enviado',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
  failed_delivery: 'Entrega fallida',
  returned: 'Devuelto',
};

export const ORDER_STATUS_TONE: Record<OrderStatus, BadgeTone> = {
  pending_confirmation: 'warn',
  confirmed: 'info',
  ready_to_ship: 'info',
  shipped: 'info',
  delivered: 'ok',
  cancelled: 'danger',
  failed_delivery: 'danger',
  returned: 'neutral',
};

// --- Estados de pago (payment.status) --------------------------------------

export const PAYMENT_STATUSES = ['pending', 'paid', 'failed'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: 'Pago pendiente',
  paid: 'Pagado',
  failed: 'Pago fallido',
};

export const PAYMENT_STATUS_TONE: Record<PaymentStatus, BadgeTone> = {
  pending: 'warn',
  paid: 'ok',
  failed: 'danger',
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash_on_delivery: 'Contra entrega (COD)',
};

export function paymentMethodLabel(method: string | null | undefined): string {
  if (!method) return '—';
  return PAYMENT_METHOD_LABELS[method] ?? method;
}

// --- Lookups seguros (para plantillas donde el valor llega como `string`) ----
// El data-table entrega cada fila como `any`; estos helpers evitan el índice
// implícito-any en el HTML y toleran un valor desconocido/nulo del backend.

export function orderStatusLabel(status: string | null | undefined): string {
  if (!status) return '—';
  return ORDER_STATUS_LABELS[status as OrderStatus] ?? status;
}

export function orderStatusTone(status: string | null | undefined): BadgeTone {
  if (!status) return 'neutral';
  return ORDER_STATUS_TONE[status as OrderStatus] ?? 'neutral';
}

export function paymentStatusLabel(status: string | null | undefined): string {
  if (!status) return '—';
  return PAYMENT_STATUS_LABELS[status as PaymentStatus] ?? status;
}

export function paymentStatusTone(status: string | null | undefined): BadgeTone {
  if (!status) return 'neutral';
  return PAYMENT_STATUS_TONE[status as PaymentStatus] ?? 'neutral';
}

// --- Máquina de estados (ESPEJO de `orderWorkflow.helper.js`, solo UX) -------
//
// `ORDER_TRANSITIONS` del backend: el camino lineal feliz + cancelación desde
// los 3 estados previos al despacho. `failed_delivery` / `returned` no tienen
// transición en UI-5.1 (fase posterior de devoluciones).

export interface OrderTransitionOption {
  to: OrderStatus;
  label: string;
  /** El backend exige `note` no vacía (cancelaciones). */
  requiresNote: boolean;
  /** Acción destructiva -> confirmación + botón en rojo. */
  destructive: boolean;
}

const ORDER_STATUS_FLOW: Partial<Record<OrderStatus, OrderTransitionOption[]>> = {
  pending_confirmation: [
    { to: 'confirmed', label: 'Confirmar pedido', requiresNote: false, destructive: false },
    { to: 'cancelled', label: 'Cancelar pedido', requiresNote: true, destructive: true },
  ],
  confirmed: [
    { to: 'ready_to_ship', label: 'Marcar listo para envío', requiresNote: false, destructive: false },
    { to: 'cancelled', label: 'Cancelar pedido', requiresNote: true, destructive: true },
  ],
  ready_to_ship: [
    { to: 'shipped', label: 'Marcar como enviado', requiresNote: false, destructive: false },
    { to: 'cancelled', label: 'Cancelar pedido', requiresNote: true, destructive: true },
  ],
  shipped: [{ to: 'delivered', label: 'Marcar como entregado', requiresNote: false, destructive: false }],
};

/** Opciones de transición que la UI ofrece desde `current` (el backend revalida). */
export function orderTransitionOptions(current: OrderStatus): OrderTransitionOption[] {
  return ORDER_STATUS_FLOW[current] ?? [];
}

export interface PaymentTransitionOption {
  to: PaymentStatus;
  label: string;
  requiresNote: boolean;
  destructive: boolean;
}

const PAYMENT_FLOW: Partial<Record<PaymentStatus, PaymentTransitionOption[]>> = {
  pending: [
    { to: 'paid', label: 'Registrar pago recibido', requiresNote: false, destructive: false },
    { to: 'failed', label: 'Marcar pago fallido', requiresNote: true, destructive: true },
  ],
};

/** Opciones de pago que la UI ofrece desde `current` (solo avanza desde `pending`). */
export function paymentTransitionOptions(current: PaymentStatus): PaymentTransitionOption[] {
  return PAYMENT_FLOW[current] ?? [];
}

// --- Límites de nota (= maxlength del schema del backend) -------------------
export const ORDER_STATUS_NOTE_MAX = 500; // statusHistory.note
export const PAYMENT_NOTE_MAX = 300; // payment.note

// --- Formas de respuesta --------------------------------------------------

/** Item del listado administrativo (`toAdminOrderListItem`). */
export interface AdminOrderListItem {
  id: string;
  orderNumber: string | null;
  userId: string | null;
  status: OrderStatus;
  payment: { method: string; status: PaymentStatus };
  totals: { itemsSubtotal: number; shipping: number; grandTotal: number; currency: string };
  itemsCount: number;
  customer: { recipientName: string; email: string; phone: string };
  createdAt: string;
  updatedAt: string;
}

export interface AdminOrderPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AdminOrderListResponse {
  items: AdminOrderListItem[];
  pagination: AdminOrderPagination;
}

export interface AdminOrderItem {
  productId: string | null;
  productName: string | null;
  slug: string | null;
  image: string | null;
  unitPrice: number | null;
  quantity: number | null;
  subtotal: number | null;
}

export interface AdminOrderStatusHistoryEntry {
  status: OrderStatus | null;
  changedAt: string | null;
  /** ObjectId en string, o `null` para un cambio automático/del cliente. El
   *  backend NO lo puebla con el nombre (DEC-C3.2-C). */
  changedBy: string | null;
  note: string | null;
}

/** Detalle administrativo (`toAdminOrderDetail`). */
export interface AdminOrderDetail {
  id: string;
  orderNumber: string | null;
  userId: string | null;
  status: OrderStatus;
  createdAt: string | null;
  updatedAt: string | null;
  customer: {
    recipientName: string | null;
    phone: string | null;
    email: string | null;
    documentId: string | null;
  };
  shippingAddress: {
    department: string | null;
    city: string | null;
    neighborhood: string | null;
    address: string | null;
    addressComplement: string | null;
    reference: string | null;
  };
  items: AdminOrderItem[];
  totals: { itemsSubtotal: number; shipping: number; grandTotal: number; currency: string };
  payment: { method: string | null; status: PaymentStatus | null };
  statusHistory: AdminOrderStatusHistoryEntry[];
  notes: string | null;
}

// --- Parámetros de consulta del listado (= contrato de `listOrdersController`) --
//
// El backend SÍ soporta paginación y filtros server-side (a diferencia de
// users/products/categories). NO soporta: búsqueda libre (`q`), ni filtro por
// `payment.status`. Ver el reporte UI-5.2 (§A / §H).

export interface AdminOrderQuery {
  page?: number;
  limit?: number;
  sort?: 'createdAt' | 'orderNumber' | 'status';
  order?: 'asc' | 'desc';
  status?: OrderStatus;
  /** Formato EXACTO DUSCK-AAAA-NNNNNN o el backend responde 400. */
  orderNumber?: string;
  userId?: string;
  /** Correo EXACTO (el backend normaliza trim+lowercase). */
  customerEmail?: string;
  /** YYYY-MM-DD (día calendario America/Bogota) o ISO-8601. */
  createdFrom?: string;
  createdTo?: string;
}

/** Campos ordenables que el backend acepta en `?sort=`. */
export const ORDER_SORT_FIELDS = ['createdAt', 'orderNumber', 'status'] as const;

export const ORDER_NUMBER_RE = /^DUSCK-\d{4}-\d{6}$/;
export const EMAIL_RE = /^\S+@\S+\.\S+$/;
