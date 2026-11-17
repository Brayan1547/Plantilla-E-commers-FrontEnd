/** Deudas del panel (`debt.model.js` / `GET /api/debts`). Solo administrador. */

export type DebtDirection = 'ME_DEBEN' | 'YO_DEBO';
export type DebtStatus = 'PENDIENTE' | 'PARCIAL' | 'PAGADA';

export const DEBT_DIRECTION_LABELS: Record<DebtDirection, string> = {
  ME_DEBEN: 'Me deben',
  YO_DEBO: 'Yo debo',
};

export const DEBT_STATUS_LABELS: Record<DebtStatus, string> = {
  PENDIENTE: 'Pendiente',
  PARCIAL: 'Abonada',
  PAGADA: 'Pagada',
};

export interface DebtPayment {
  _id: string;
  amount: number;
  paidAt: string;
  note?: string;
}

export interface Debt {
  _id: string;
  direction: DebtDirection;
  personName: string;
  personPhone?: string;
  concept?: string;
  /** Monto total en pesos (entero). */
  amount: number;
  paidAmount: number;
  /** Lo que falta por pagar (calculado por el backend). */
  balance: number;
  payments: DebtPayment[];
  /** Fecha límite como 'AAAA-MM-DD' (sin hora). */
  dueDate: string | null;
  status: DebtStatus;
  /** true si la fecha límite ya pasó y la deuda no está pagada. */
  overdue: boolean;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DebtSummaryBucket {
  total: number;
  count: number;
  overdueTotal: number;
  overdueCount: number;
}

export interface DebtSummary {
  meDeben: DebtSummaryBucket;
  yoDebo: DebtSummaryBucket;
}

export interface DebtPayload {
  direction?: DebtDirection;
  personName: string;
  personPhone?: string;
  concept?: string;
  amount: number;
  /** 'AAAA-MM-DD', o null para quitar la fecha. */
  dueDate?: string | null;
  notes?: string;
}

export interface PaymentPayload {
  amount: number;
  /** 'AAAA-MM-DD'; si no se envía, el backend usa hoy. */
  paidAt?: string;
  note?: string;
}