import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { AdminDashboardApi } from './dashboard.api';
import type { DashboardData } from './dashboard.models';

describe('AdminDashboardApi', () => {
  let http: HttpTestingController;
  let api: AdminDashboardApi;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AdminDashboardApi, provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    api = TestBed.inject(AdminDashboardApi);
  });

  afterEach(() => http.verify());

  const DATA: DashboardData = {
    range: { from: 'a', to: 'b', timezone: 'America/Bogota', granularity: 'day' },
    summary: {
      today: { ordersCount: 0, salesTotal: 0 },
      period: { ordersCount: 0, salesTotal: 0, averageTicket: 0 },
      collectedRevenue: { period: 0 },
      currency: 'COP',
    },
    salesSeries: [],
    orders: {
      total: 0,
      byStatus: {
        pending_confirmation: 0,
        confirmed: 0,
        ready_to_ship: 0,
        shipped: 0,
        delivered: 0,
        cancelled: 0,
        failed_delivery: 0,
        returned: 0,
      },
    },
    topProducts: [],
    inventory: {
      totalProducts: 0,
      publishedProducts: 0,
      lowStock: 0,
      outOfStock: 0,
      lowStockThreshold: 5,
    },
    alerts: [],
  };

  it('get() hace GET /dashboard y desenvuelve `data`', () => {
    let out: DashboardData | undefined;
    api.get().subscribe((r) => (out = r));
    const req = http.expectOne((r) => r.url.endsWith('/dashboard'));
    expect(req.request.method).toBe('GET');
    req.flush({ msg: 'ok', data: DATA });
    expect(out?.summary.currency).toBe('COP');
  });

  it('get() manda from/to/granularity presentes y omite los vacíos', () => {
    api.get({ from: '2026-01-01', to: '2026-01-31' }).subscribe();
    const req = http.expectOne((r) => r.url.endsWith('/dashboard'));
    expect(req.request.params.get('from')).toBe('2026-01-01');
    expect(req.request.params.get('to')).toBe('2026-01-31');
    expect(req.request.params.has('granularity')).toBe(false);
    req.flush({ msg: 'ok', data: DATA });
  });

  it('propaga el 403 del backend (rol sin acceso)', () => {
    let err: unknown;
    api.get().subscribe({ error: (e) => (err = e) });
    http
      .expectOne((r) => r.url.endsWith('/dashboard'))
      .flush({ msg: 'El rol editor no esta autorizado' }, { status: 403, statusText: 'Forbidden' });
    expect((err as { status: number }).status).toBe(403);
  });
});
