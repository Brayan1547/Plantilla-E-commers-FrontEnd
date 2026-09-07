import {
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_TONE,
  PAYMENT_STATUSES,
  PAYMENT_STATUS_LABELS,
  orderTransitionOptions,
  paymentTransitionOptions,
  paymentMethodLabel,
  ORDER_NUMBER_RE,
  EMAIL_RE,
  type OrderStatus,
} from './admin-order.model';

/**
 * UI-5.2 — La máquina de estados de la UI debe ser un ESPEJO fiel de
 * `orderWorkflow.helper.js` (backend). Estos tests fijan ese contrato: si el
 * backend añade/quita una arista, este archivo falla y obliga a sincronizar.
 */
describe('admin-order.model — máquina de estados (espejo del backend)', () => {
  it('cada estado y estado de pago tiene etiqueta y tono', () => {
    for (const s of ORDER_STATUSES) {
      expect(ORDER_STATUS_LABELS[s]).toBeTruthy();
      expect(ORDER_STATUS_TONE[s]).toBeTruthy();
    }
    for (const p of PAYMENT_STATUSES) {
      expect(PAYMENT_STATUS_LABELS[p]).toBeTruthy();
    }
  });

  it('camino feliz: cada paso ofrece exactamente la siguiente transición', () => {
    const forward = (s: OrderStatus) =>
      orderTransitionOptions(s)
        .filter((o) => !o.destructive)
        .map((o) => o.to);

    expect(forward('pending_confirmation')).toEqual(['confirmed']);
    expect(forward('confirmed')).toEqual(['ready_to_ship']);
    expect(forward('ready_to_ship')).toEqual(['shipped']);
    expect(forward('shipped')).toEqual(['delivered']);
  });

  it('cancelación disponible SOLO desde los 3 estados previos al despacho, y exige nota', () => {
    for (const s of ['pending_confirmation', 'confirmed', 'ready_to_ship'] as OrderStatus[]) {
      const cancel = orderTransitionOptions(s).find((o) => o.to === 'cancelled');
      expect(cancel).toBeTruthy();
      expect(cancel!.requiresNote).toBe(true);
      expect(cancel!.destructive).toBe(true);
    }
  });

  it('estados terminales / posteriores al despacho NO ofrecen transiciones', () => {
    for (const s of ['shipped'] as OrderStatus[]) {
      expect(orderTransitionOptions(s).some((o) => o.to === 'cancelled')).toBe(false);
    }
    for (const s of ['delivered', 'cancelled', 'failed_delivery', 'returned'] as OrderStatus[]) {
      expect(orderTransitionOptions(s)).toEqual([]);
    }
  });

  it('pago: solo avanza desde pending; failed exige nota; sin retrocesos', () => {
    const fromPending = paymentTransitionOptions('pending').map((o) => o.to).sort();
    expect(fromPending).toEqual(['failed', 'paid']);
    expect(paymentTransitionOptions('pending').find((o) => o.to === 'failed')!.requiresNote).toBe(true);
    expect(paymentTransitionOptions('paid')).toEqual([]);
    expect(paymentTransitionOptions('failed')).toEqual([]);
  });

  it('paymentMethodLabel traduce COD y cae al valor crudo si no lo conoce', () => {
    expect(paymentMethodLabel('cash_on_delivery')).toContain('Contra entrega');
    expect(paymentMethodLabel('otro')).toBe('otro');
    expect(paymentMethodLabel(null)).toBe('—');
  });

  it('regex de número de pedido y correo coinciden con el backend', () => {
    expect(ORDER_NUMBER_RE.test('DUSCK-2026-000123')).toBe(true);
    expect(ORDER_NUMBER_RE.test('dusck-2026-000123')).toBe(false);
    expect(ORDER_NUMBER_RE.test('DUSCK-2026-123')).toBe(false);
    expect(EMAIL_RE.test('ana@dusck.co')).toBe(true);
    expect(EMAIL_RE.test('ana@dusck')).toBe(false);
  });
});
