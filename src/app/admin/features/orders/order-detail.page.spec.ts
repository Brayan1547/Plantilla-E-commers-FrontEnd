import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { vi } from 'vitest';

import OrderDetailPage from './order-detail.page';
import { PermissionsService } from '../../core/services/permissions';
import { AdminDialog } from '../../core/services/admin-dialog';
import type { Permission } from '../../core/models/permission.model';
import type { AdminOrderDetail } from '../../core/models/admin-order.model';

describe('OrderDetailPage (admin)', () => {
  let httpMock: HttpTestingController;
  let dialog: { confirm: any; promptText: any; success: any; error: any };

  function fakePermissions(granted: Permission[]) {
    return {
      role: () => 'administrador',
      can: (p: Permission) => granted.includes(p),
      canAny: (ps: readonly Permission[]) => ps.some((p) => granted.includes(p)),
      canAll: (ps: readonly Permission[]) => ps.every((p) => granted.includes(p)),
    };
  }

  function setup(granted: Permission[]) {
    dialog = {
      confirm: vi.fn().mockResolvedValue(true),
      promptText: vi.fn().mockResolvedValue('un motivo válido'),
      success: vi.fn(),
      error: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: PermissionsService, useValue: fakePermissions(granted) },
        { provide: AdminDialog, useValue: dialog },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 'o1' } } } },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(OrderDetailPage);
    fixture.detectChanges();
    return fixture;
  }

  function flushDetail(over: Partial<AdminOrderDetail> = {}) {
    httpMock.expectOne((r) => r.url.endsWith('/orders/o1') && r.method === 'GET').flush({
      msg: 'ok',
      data: { ...DETAIL, ...over },
    });
  }

  afterEach(() => httpMock.verify());

  const DETAIL: AdminOrderDetail = {
    id: 'o1',
    orderNumber: 'DUSCK-2026-000001',
    userId: null,
    status: 'pending_confirmation',
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z',
    customer: { recipientName: 'Ana Gómez', phone: '3001234567', email: 'ana@dusck.co', documentId: null },
    shippingAddress: {
      department: 'Antioquia', city: 'Medellín', neighborhood: 'Laureles',
      address: 'Calle 12 # 34-56', addressComplement: null, reference: null,
    },
    items: [
      { productId: 'p1', productName: 'Camiseta', slug: 'camiseta', image: null, unitPrice: 50000, quantity: 1, subtotal: 50000 },
    ],
    totals: { itemsSubtotal: 50000, shipping: 0, grandTotal: 50000, currency: 'COP' },
    payment: { method: 'cash_on_delivery', status: 'pending' },
    statusHistory: [{ status: 'pending_confirmation', changedAt: '2026-09-01T10:00:00.000Z', changedBy: null, note: null }],
    notes: null,
  };

  it('renderiza el detalle: número, cliente y total', () => {
    const f = setup(['orders.read']);
    flushDetail();
    f.detectChanges();
    const text = (f.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('DUSCK-2026-000001');
    expect(text).toContain('Ana Gómez');
    expect(text).toContain('Antioquia');
  });

  it('con orders.manageStatus + estado pending -> ofrece "Confirmar" y "Cancelar"', () => {
    const f = setup(['orders.read', 'orders.manageStatus']);
    flushDetail();
    const actions = (f.componentInstance as any).statusActions().map((a: any) => a.to);
    expect(actions).toEqual(['confirmed', 'cancelled']);
  });

  it('sin orders.manageStatus -> ninguna acción de estado', () => {
    const f = setup(['orders.read']);
    flushDetail();
    expect((f.componentInstance as any).statusActions()).toEqual([]);
  });

  it('estado delivered -> sin acciones y marcado como terminal', () => {
    const f = setup(['orders.read', 'orders.manageStatus']);
    flushDetail({ status: 'delivered' });
    const cmp = f.componentInstance as any;
    expect(cmp.statusActions()).toEqual([]);
    expect(cmp.isTerminal()).toBe(true);
  });

  it('solo orders.managePayment con pago pending -> ofrece pagar / marcar fallido', () => {
    const f = setup(['orders.read', 'orders.managePayment']);
    flushDetail();
    const pay = (f.componentInstance as any).paymentActions().map((a: any) => a.to).sort();
    expect(pay).toEqual(['failed', 'paid']);
  });

  it('confirmar (transición sin nota) -> PATCH /status y refresca con la respuesta', () => {
    const f = setup(['orders.read', 'orders.manageStatus']);
    flushDetail();
    const cmp = f.componentInstance as any;
    const opt = cmp.statusActions().find((a: any) => a.to === 'confirmed');

    return cmp.applyStatus(opt).then(() => {
      expect(dialog.confirm).toHaveBeenCalled();
      const req = httpMock.expectOne((r) => r.url.endsWith('/orders/o1/status'));
      expect(req.request.body).toEqual({ status: 'confirmed' });
      req.flush({ msg: 'ok', data: { ...DETAIL, status: 'confirmed' } });
      expect(cmp.order().status).toBe('confirmed');
      expect(dialog.success).toHaveBeenCalled();
    });
  });

  it('cancelar sin motivo (promptText -> null) -> NO envía ninguna request', () => {
    const f = setup(['orders.read', 'orders.manageStatus']);
    flushDetail();
    const cmp = f.componentInstance as any;
    dialog.promptText.mockResolvedValueOnce(null);
    const opt = cmp.statusActions().find((a: any) => a.to === 'cancelled');

    return cmp.applyStatus(opt).then(() => {
      httpMock.expectNone((r) => r.url.endsWith('/orders/o1/status'));
    });
  });

  it('cancelar con motivo -> PATCH { status: cancelled, note }', () => {
    const f = setup(['orders.read', 'orders.manageStatus']);
    flushDetail();
    const cmp = f.componentInstance as any;
    dialog.promptText.mockResolvedValueOnce('cliente se arrepintió');
    const opt = cmp.statusActions().find((a: any) => a.to === 'cancelled');

    return cmp.applyStatus(opt).then(() => {
      const req = httpMock.expectOne((r) => r.url.endsWith('/orders/o1/status'));
      expect(req.request.body).toEqual({ status: 'cancelled', note: 'cliente se arrepintió' });
      req.flush({ msg: 'ok', data: { ...DETAIL, status: 'cancelled' } });
      expect(cmp.order().status).toBe('cancelled');
    });
  });

  it('409 en una transición -> avisa y recarga el detalle (no sobrescribe estado local)', () => {
    const f = setup(['orders.read', 'orders.manageStatus']);
    flushDetail();
    const cmp = f.componentInstance as any;
    const opt = cmp.statusActions().find((a: any) => a.to === 'confirmed');

    return cmp.applyStatus(opt).then(() => {
      httpMock
        .expectOne((r) => r.url.endsWith('/orders/o1/status'))
        .flush({ msg: 'El pedido cambió de estado…' }, { status: 409, statusText: 'Conflict' });

      expect(dialog.error).toHaveBeenCalled();
      // se dispara un GET de refresco
      httpMock
        .expectOne((r) => r.url.endsWith('/orders/o1') && r.method === 'GET')
        .flush({ msg: 'ok', data: { ...DETAIL, status: 'confirmed' } });
      expect(cmp.order().status).toBe('confirmed');
    });
  });
});
