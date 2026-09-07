import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import OrderListPage from './order-list.page';
import { PermissionsService } from '../../core/services/permissions';
import type { Permission } from '../../core/models/permission.model';
import type { AdminOrderListItem } from '../../core/models/admin-order.model';

describe('OrderListPage (admin)', () => {
  let httpMock: HttpTestingController;

  function fakePermissions(granted: Permission[]) {
    return {
      role: () => 'administrador',
      can: (p: Permission) => granted.includes(p),
      canAny: (ps: readonly Permission[]) => ps.some((p) => granted.includes(p)),
      canAll: (ps: readonly Permission[]) => ps.every((p) => granted.includes(p)),
    };
  }

  function setup(granted: Permission[] = ['orders.read']) {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: PermissionsService, useValue: fakePermissions(granted) },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(OrderListPage);
    fixture.detectChanges(); // dispara load()
    return fixture;
  }

  function expectList() {
    return httpMock.expectOne((r) => r.url.endsWith('/orders') && r.method === 'GET');
  }

  function flush(items: Partial<AdminOrderListItem>[], total = items.length) {
    expectList().flush({
      msg: 'ok',
      data: { items, pagination: { page: 1, limit: 20, total, totalPages: Math.ceil(total / 20) || 0 } },
    });
  }

  afterEach(() => httpMock.verify());

  const ORDER: Partial<AdminOrderListItem> = {
    id: 'o1',
    orderNumber: 'DUSCK-2026-000001',
    status: 'pending_confirmation',
    payment: { method: 'cash_on_delivery', status: 'pending' },
    totals: { itemsSubtotal: 50000, shipping: 0, grandTotal: 50000, currency: 'COP' },
    itemsCount: 1,
    customer: { recipientName: 'Ana Gómez', email: 'ana@dusck.co', phone: '3001234567' },
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z',
  };

  it('carga inicial: GET /orders con paginación y orden por defecto', () => {
    setup();
    const req = expectList();
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('limit')).toBe('20');
    expect(req.request.params.get('sort')).toBe('createdAt');
    expect(req.request.params.get('order')).toBe('desc');
    req.flush({ msg: 'ok', data: { items: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } } });
  });

  it('estado ready con filas -> renderiza el número de pedido y el cliente', () => {
    const f = setup();
    flush([ORDER]);
    f.detectChanges();
    const text = (f.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('DUSCK-2026-000001');
    expect(text).toContain('Ana Gómez');
  });

  it('respuesta vacía -> estado empty', () => {
    const f = setup();
    flush([]);
    f.detectChanges();
    expect((f.componentInstance as any).tableState()).toBe('empty');
  });

  it('error del backend -> estado error con el mensaje', () => {
    const f = setup();
    expectList().flush({ msg: 'Explotó' }, { status: 500, statusText: 'Error' });
    f.detectChanges();
    expect((f.componentInstance as any).state()).toBe('error');
    expect((f.componentInstance as any).errorMsg()).toBeTruthy();
  });

  it('filtro por estado (select) -> recarga inmediata con ?status=', () => {
    const f = setup();
    flush([ORDER]);
    const cmp = f.componentInstance as any;
    cmp.statusFilter.set('confirmed');
    cmp.reloadNow();
    const req = expectList();
    expect(req.request.params.get('status')).toBe('confirmed');
    expect(req.request.params.get('page')).toBe('1');
    req.flush({ msg: 'ok', data: { items: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } } });
  });

  it('orderNumber con formato inválido NO se envía como filtro', () => {
    const f = setup();
    flush([ORDER]);
    const cmp = f.componentInstance as any;
    cmp.orderNumberInput.set('123');
    expect(cmp.orderNumberInvalid()).toBe(true);
    cmp.reloadNow();
    const req = expectList();
    expect(req.request.params.has('orderNumber')).toBe(false);
    req.flush({ msg: 'ok', data: { items: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } } });
  });

  it('orderNumber con formato válido SÍ se envía (normalizado a mayúsculas)', () => {
    const f = setup();
    flush([ORDER]);
    const cmp = f.componentInstance as any;
    cmp.orderNumberInput.set('dusck-2026-000009');
    cmp.reloadNow();
    const req = expectList();
    expect(req.request.params.get('orderNumber')).toBe('DUSCK-2026-000009');
    req.flush({ msg: 'ok', data: { items: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } } });
  });

  it('cambio de página -> GET /orders con ?page=2', () => {
    const f = setup();
    flush(Array.from({ length: 20 }, (_, i) => ({ ...ORDER, id: `o${i}` })), 45);
    (f.componentInstance as any).onPage(2);
    const req = expectList();
    expect(req.request.params.get('page')).toBe('2');
    req.flush({ msg: 'ok', data: { items: [], pagination: { page: 2, limit: 20, total: 45, totalPages: 3 } } });
  });

  it('ordenar por columna no soportada por el backend -> no recarga', () => {
    const f = setup();
    flush([ORDER]);
    (f.componentInstance as any).onSort({ key: 'total', dir: 'asc' });
    httpMock.expectNone(() => true); // ninguna request nueva
  });
});
