/**
 * UI-4B — Compra como invitado (Checkout COD).
 *
 * Tipado MÍNIMO del contrato real de `POST /api/orders` ya auditado en UI-4A.
 * Solo se modela lo que el frontend construye (request) y lo que consume
 * (respuesta 201). NO se añaden campos que el backend no exponga.
 *
 * El backend es la ÚNICA autoridad de precios, totales, stock, `status`,
 * `payment`, `orderNumber` y `userId`. El frontend NUNCA los envía.
 */

/** Método de pago único de la fase (F4 / UI-4B): pago contra entrega. */
export const PAYMENT_METHOD_COD = 'cash_on_delivery';

/** Tope de unidades por línea, alineado con el backend (`MAX_ORDER_ITEM_QTY`). */
export const MAX_ORDER_ITEM_QTY = 50;
export const MIN_ORDER_ITEM_QTY = 1;

// ---------------------------------------------------------------------------
// REQUEST — lo que el checkout envía. Shape EXACTO del contrato, nada más.
// ---------------------------------------------------------------------------

/** Línea del pedido: el contrato acepta únicamente `{ productId, quantity }`. */
export interface CreateOrderItem {
  productId: string;
  quantity: number;
}

/** Datos del comprador aceptados por el contrato (`CUSTOMER_FIELDS`). */
export interface OrderCustomer {
  recipientName: string;
  phone: string;
  email: string;
  documentId?: string;
}

/** Dirección de entrega aceptada por el contrato (`SHIPPING_FIELDS`). */
export interface OrderShippingAddress {
  department: string;
  city: string;
  neighborhood: string;
  address: string;
  addressComplement?: string;
  reference?: string;
}

/** Cuerpo EXACTO de `POST /api/orders`. Sin price/totals/status/payment/userId. */
export interface CreateOrderPayload {
  items: CreateOrderItem[];
  customer: OrderCustomer;
  shippingAddress: OrderShippingAddress;
  notes?: string;
}

// ---------------------------------------------------------------------------
// RESPONSE — proyección pública `toPublicOrder` del backend (respuesta 201).
// ---------------------------------------------------------------------------

export interface OrderItemView {
  productId: string;
  productName: string;
  slug: string;
  image: string | null;
  unitPrice: number;
  quantity: number;
  subtotal: number;
}

export interface OrderTotals {
  itemsSubtotal: number;
  shipping: number;
  grandTotal: number;
  currency: string;
}

export interface OrderPayment {
  method: string;
  status: string;
}

/** Respuesta de `POST /api/orders` (campo `data`). */
export interface OrderConfirmation {
  id: string;
  orderNumber: string | null;
  status: string;
  userId: string | null;
  items: OrderItemView[];
  totals: OrderTotals;
  payment: OrderPayment;
  customer: OrderCustomer;
  shippingAddress: OrderShippingAddress;
  notes?: string;
  createdAt: string;
}

/** Envoltura estándar del backend. */
export interface OrderApiEnvelope {
  msg: string;
  data: OrderConfirmation;
}
