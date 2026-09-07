import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { HttpOrder } from './http-order';
import type { CreateOrderPayload } from '../models/order.model';

describe('HttpOrder', () => {
  let http: HttpTestingController;
  let svc: HttpOrder;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [HttpOrder, provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    svc = TestBed.inject(HttpOrder);
  });

  afterEach(() => http.verify());

  const PAYLOAD: CreateOrderPayload = {
    items: [{ productId: 'a'.repeat(24), quantity: 2 }],
    customer: { recipientName: 'Ana Gómez', phone: '3001234567', email: 'ana@dusck.co' },
    shippingAddress: {
      department: 'Antioquia',
      city: 'Medellín',
      neighborhood: 'Laureles',
      address: 'Calle 12 # 34-56',
    },
  };

  const KEY = '11111111-1111-4111-8111-111111111111';

  it('hace POST /api/orders con el payload EXACTO y el header Idempotency-Key', () => {
    let result: unknown;
    svc.createOrder(PAYLOAD, KEY).subscribe((r) => (result = r));

    const req = http.expectOne((r) => r.url.endsWith('/orders'));
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('Idempotency-Key')).toBe(KEY);
    expect(req.request.body).toEqual(PAYLOAD);
    // No se filtran campos server-owned.
    const bodyKeys = Object.keys(req.request.body as object);
    expect(bodyKeys.sort()).toEqual(['customer', 'items', 'shippingAddress'].sort());

    req.flush({ msg: 'Pedido creado exitosamente', data: { orderNumber: 'DUSCK-2026-000001' } });
    expect((result as { orderNumber: string }).orderNumber).toBe('DUSCK-2026-000001');
  });

  it('devuelve el campo `data` de la envoltura del backend', () => {
    let result: unknown;
    svc.createOrder(PAYLOAD, KEY).subscribe((r) => (result = r));
    http
      .expectOne((r) => r.url.endsWith('/orders'))
      .flush({ msg: 'ok', data: { id: 'x', status: 'pending_confirmation' } });
    expect(result).toEqual({ id: 'x', status: 'pending_confirmation' });
  });

  it('propaga los errores HTTP del backend (409 sin stock)', () => {
    let err: { status: number } | undefined;
    svc.createOrder(PAYLOAD, KEY).subscribe({ error: (e) => (err = e) });
    http
      .expectOne((r) => r.url.endsWith('/orders'))
      .flush({ msg: 'No hay stock suficiente' }, { status: 409, statusText: 'Conflict' });
    expect(err?.status).toBe(409);
  });
});
