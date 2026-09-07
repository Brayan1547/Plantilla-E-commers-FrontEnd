import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { AdminOrdersApi } from './admin-orders.api';
import type { AdminOrderDetail } from '../models/admin-order.model';

describe('AdminOrdersApi', () => {
  let http: HttpTestingController;
  let api: AdminOrdersApi;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AdminOrdersApi, provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    api = TestBed.inject(AdminOrdersApi);
  });

  afterEach(() => http.verify());

  const DETAIL: Partial<AdminOrderDetail> = {
    id: 'o1',
    orderNumber: 'DUSCK-2026-000001',
    status: 'pending_confirmation',
    payment: { method: 'cash_on_delivery', status: 'pending' },
    items: [],
    totals: { itemsSubtotal: 1000, shipping: 0, grandTotal: 1000, currency: 'COP' },
    statusHistory: [],
  };

  it('list() manda page/limit/sort/order y los filtros presentes, y omite los vacíos', () => {
    api.list({ page: 2, limit: 20, sort: 'createdAt', order: 'desc', status: 'confirmed', customerEmail: 'ana@dusck.co' }).subscribe();
    const req = http.expectOne((r) => r.url.endsWith('/orders'));
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('limit')).toBe('20');
    expect(req.request.params.get('sort')).toBe('createdAt');
    expect(req.request.params.get('order')).toBe('desc');
    expect(req.request.params.get('status')).toBe('confirmed');
    expect(req.request.params.get('customerEmail')).toBe('ana@dusck.co');
    expect(req.request.params.has('orderNumber')).toBe(false);
    req.flush({ msg: 'ok', data: { items: [], pagination: { page: 2, limit: 20, total: 0, totalPages: 0 } } });
  });

  it('list() desenvuelve `data` (items + pagination)', () => {
    let out: unknown;
    api.list().subscribe((r) => (out = r));
    http.expectOne((r) => r.url.endsWith('/orders')).flush({
      msg: 'ok',
      data: { items: [{ id: 'o1' }], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } },
    });
    expect((out as { pagination: { total: number } }).pagination.total).toBe(1);
  });

  it('getById() hace GET /orders/:id y desenvuelve el detalle', () => {
    let out: unknown;
    api.getById('o1').subscribe((r) => (out = r));
    const req = http.expectOne((r) => r.url.endsWith('/orders/o1'));
    expect(req.request.method).toBe('GET');
    req.flush({ msg: 'ok', data: DETAIL });
    expect((out as AdminOrderDetail).orderNumber).toBe('DUSCK-2026-000001');
  });

  it('updateStatus() hace PATCH /orders/:id/status con { status, note } y recorta la nota', () => {
    api.updateStatus('o1', 'cancelled', '  cliente canceló  ').subscribe();
    const req = http.expectOne((r) => r.url.endsWith('/orders/o1/status'));
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ status: 'cancelled', note: 'cliente canceló' });
    req.flush({ msg: 'ok', data: { ...DETAIL, status: 'cancelled' } });
  });

  it('updateStatus() sin nota NO envía la clave `note`', () => {
    api.updateStatus('o1', 'confirmed').subscribe();
    const req = http.expectOne((r) => r.url.endsWith('/orders/o1/status'));
    expect(req.request.body).toEqual({ status: 'confirmed' });
    req.flush({ msg: 'ok', data: { ...DETAIL, status: 'confirmed' } });
  });

  it('updatePayment() hace PATCH /orders/:id/payment con { status, note }', () => {
    api.updatePayment('o1', 'failed', 'sin efectivo').subscribe();
    const req = http.expectOne((r) => r.url.endsWith('/orders/o1/payment'));
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ status: 'failed', note: 'sin efectivo' });
    req.flush({ msg: 'ok', data: { ...DETAIL, payment: { method: 'cash_on_delivery', status: 'failed' } } });
  });

  it('propaga los errores HTTP del backend (409 conflicto de concurrencia)', () => {
    let err: unknown;
    api.updateStatus('o1', 'confirmed').subscribe({ error: (e) => (err = e) });
    http
      .expectOne((r) => r.url.endsWith('/orders/o1/status'))
      .flush({ msg: 'El pedido cambió de estado…' }, { status: 409, statusText: 'Conflict' });
    expect((err as { status: number }).status).toBe(409);
  });
});
