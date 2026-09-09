import type { BadgeTone } from '../../shared/ui/status-badge/status-badge';
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_TONE,
  type OrderStatus,
} from '../../core/models/admin-order.model';

/**
 * UI-5.3 — Tipos del panel de indicadores (Dashboard).
 *
 * Espejo EXACTO del contrato de `GET /api/dashboard`
 * (`Backend-Dusck/src/controllers/dashboard.controller.js`), tras
 * `autenticationUser` + `authorizationUser(['administrador','shop_manager'])`.
 *
 * El backend es la ÚNICA autoridad de los cálculos. Este archivo NO declara
 * ninguna métrica que el backend no exponga: no hay tráfico, visitantes,
 * sesiones, conversión ni fuentes de tráfico (no existen esos datos en el
 * dominio). Todos los contadores llegan zero-filled: 0 pedidos / 0 ventas NO
 * es un error, es un estado válido.
 */

export type DashboardGranularity = 'day' | 'month';
export type AlertSeverity = 'warn' | 'danger';

export interface DashboardRange {
  from: string;
  to: string;
  timezone: string;
  granularity: DashboardGranularity;
}

export interface DashboardSummary {
  today: { ordersCount: number; salesTotal: number };
  period: { ordersCount: number; salesTotal: number; averageTicket: number };
  /** Σ de `grandTotal` de pedidos con `payment.status = "paid"` (efectivo cobrado). */
  collectedRevenue: { period: number };
  currency: string;
}

export interface SalesBucket {
  /** `YYYY-MM-DD` (día) o `YYYY-MM` (mes). */
  bucket: string;
  ordersCount: number;
  salesTotal: number;
}

export interface OrdersBreakdown {
  /** Nº de pedidos finalizados del rango (TODOS los estados). */
  total: number;
  /** Los 8 estados de `ORDER_STATUS`, siempre presentes. */
  byStatus: Record<OrderStatus, number>;
}

export interface TopProduct {
  productId: string | null;
  productName: string | null;
  slug: string | null;
  unitsSold: number;
  salesTotal: number;
}

export interface InventorySummary {
  totalProducts: number;
  publishedProducts: number;
  lowStock: number;
  outOfStock: number;
  lowStockThreshold: number;
}

export interface OperationalAlert {
  code: string;
  severity: AlertSeverity;
  count: number;
  message: string;
}

export interface DashboardData {
  range: DashboardRange;
  summary: DashboardSummary;
  salesSeries: SalesBucket[];
  orders: OrdersBreakdown;
  topProducts: TopProduct[];
  inventory: InventorySummary;
  alerts: OperationalAlert[];
}

/** Parámetros de `GET /api/dashboard` (todos opcionales). */
export interface DashboardQuery {
  /** `YYYY-MM-DD` (día calendario America/Bogota) o ISO-8601. */
  from?: string;
  to?: string;
  granularity?: DashboardGranularity;
}

// --- Presets de rango (UX; el backend acepta cualquier `from`/`to`) ----------

export interface RangePreset {
  id: string;
  label: string;
  /** Días hacia atrás desde hoy (inclusive). */
  days: number;
}

export const RANGE_PRESETS: RangePreset[] = [
  { id: '7d', label: 'Últimos 7 días', days: 7 },
  { id: '30d', label: 'Últimos 30 días', days: 30 },
  { id: '90d', label: 'Últimos 90 días', days: 90 },
];

export const DEFAULT_RANGE_PRESET = '30d';

// --- Fechas (UI-5.4) --------------------------------------------------------
//
// Toda la lógica de fecha del Dashboard vive AQUÍ (no se duplica en la página).
// La API SIEMPRE recibe `YYYY-MM-DD`; el backend lo interpreta en America/Bogota
// (mismo criterio que `dashboard.helper.js::bogotaDateString`). La PRESENTACIÓN
// al usuario es es-CO y nunca ISO.

const BOGOTA_TZ = 'America/Bogota';

/**
 * `YYYY-MM-DD` del día de HOY en la zona operativa de DUSCK (America/Bogota).
 *
 * Se resuelve con `Intl` + `timeZone`, NUNCA con `toISOString()` (que daría el
 * día UTC y, de madrugada, podría adelantar/atrasar el día en Colombia, UTC-5).
 * Es también el máximo seleccionable en el calendario (no se permiten futuros).
 */
export function bogotaToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BOGOTA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/** Suma `delta` días (puede ser negativo) a un `YYYY-MM-DD`, en aritmética UTC pura. */
export function addDays(iso: string, delta: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

/**
 * Rango `{ from, to }` de un preset de `days` días, anclado a HOY (Bogotá) y
 * ambos inclusive. La granularidad se deja al backend (día para <=92 días).
 */
export function presetRangeQuery(days: number): DashboardQuery {
  const to = bogotaToday();
  return { from: addDays(to, -(days - 1)), to };
}

/** Query para un único día: `from == to`, granularidad `day` (contrato UI-5.4). */
export function dayRangeQuery(date: string): DashboardQuery {
  return { from: date, to: date, granularity: 'day' };
}

/**
 * `YYYY-MM-DD` -> "15 de agosto de 2026" (es-CO). Construye la fecha con partes
 * LOCALES (`new Date(y, m-1, d)`), no `new Date(iso)` (que parsea como UTC y
 * podría desplazar el día al formatear).
 */
export function formatDateLong(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Intl.DateTimeFormat('es-CO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(y, m - 1, d));
}

// --- Selección de período (UI-5.4) ----------------------------------------

/**
 * Estado del selector: un preset (7/30/90 días) O una fecha específica. Son
 * mutuamente excluyentes — elegir uno abandona el otro.
 */
export type PeriodSelection =
  | { kind: 'preset'; presetId: string }
  | { kind: 'day'; date: string };

export const DEFAULT_PERIOD_SELECTION: PeriodSelection = {
  kind: 'preset',
  presetId: DEFAULT_RANGE_PRESET,
};

/** Construye la `DashboardQuery` para una selección de período. */
export function selectionToQuery(sel: PeriodSelection): DashboardQuery {
  if (sel.kind === 'day') return dayRangeQuery(sel.date);
  const days = RANGE_PRESETS.find((p) => p.id === sel.presetId)?.days ?? 30;
  return presetRangeQuery(days);
}

/** Etiqueta legible del período (es-CO), nunca ISO. */
export function selectionLabel(sel: PeriodSelection): string {
  if (sel.kind === 'day') return formatDateLong(sel.date);
  return RANGE_PRESETS.find((p) => p.id === sel.presetId)?.label ?? '';
}

/** Clave estable de una query, para no repetir la misma petición. */
export function queryKey(q: DashboardQuery): string {
  return `${q.from ?? ''}|${q.to ?? ''}|${q.granularity ?? ''}`;
}

// --- Lookups de presentación -----------------------------------------------

/** Etiqueta + tono de un estado de pedido (reutiliza el mapa del módulo de pedidos). */
export function statusLabel(status: string): string {
  return ORDER_STATUS_LABELS[status as OrderStatus] ?? status;
}
export function statusTone(status: string): BadgeTone {
  return ORDER_STATUS_TONE[status as OrderStatus] ?? 'neutral';
}

export const ALERT_TONE: Record<AlertSeverity, BadgeTone> = {
  warn: 'warn',
  danger: 'danger',
};

/** Etiqueta corta de un bucket de serie para el eje de la gráfica. */
export function bucketShortLabel(bucket: string): string {
  // `YYYY-MM-DD` -> `DD/MM` ; `YYYY-MM` -> `MM/YYYY`
  const parts = bucket.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
  if (parts.length === 2) return `${parts[1]}/${parts[0]}`;
  return bucket;
}
