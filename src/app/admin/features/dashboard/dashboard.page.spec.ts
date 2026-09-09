import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { afterEach, describe, expect, it } from 'vitest';

import DashboardPage from './dashboard.page';
import { addDays, bogotaToday, type DashboardData } from './dashboard.models';
import { HttpAuth } from '../../../core/services/http-auth';
import { PermissionsService } from '../../core/services/permissions';

/**
 * UI-5.4 — selector de período del Dashboard.
 *
 * Sin timers falsos: las fechas de los presets se comprueban contra los mismos
 * helpers TZ-safe del módulo (`bogotaToday` / `addDays`) — se verifica que la
 * PÁGINA los CABLEA bien (from = hoy − (n−1), to = hoy, granularity), no la
 * aritmética de fechas en sí. Los casos de fecha específica usan literales.
 *
 * `PermissionsService` y `HttpAuth` se reemplazan por dobles simples (misma
 * estrategia que `product-list.page.spec`).
 */
describe('DashboardPage · selector de período (UI-5.4)', () => {
  let httpMock: HttpTestingController;

  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

  const fakePermissions = {
    role: () => 'administrador',
    can: () => true,
    canAny: () => true,
    canAll: () => true,
  };
  const fakeAuth = { user$: of({ name: 'Admin User' }), user: { name: 'Admin User' } };

  function makeData(over: Partial<DashboardData> = {}): DashboardData {
    return {
      range: { from: 'x', to: 'y', timezone: 'America/Bogota', granularity: 'day' },
      summary: {
        today: { ordersCount: 0, salesTotal: 0 },
        period: { ordersCount: 0, salesTotal: 0, averageTicket: 0 },
        collectedRevenue: { period: 0 },
        currency: 'COP',
      },
      salesSeries: [],
      orders: {
        total: 3,
        byStatus: {
          pending_confirmation: 0,
          confirmed: 0,
          ready_to_ship: 0,
          shipped: 0,
          delivered: 3,
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
      ...over,
    };
  }

  function setup() {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: PermissionsService, useValue: fakePermissions },
        { provide: HttpAuth, useValue: fakeAuth },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(DashboardPage);
    fixture.detectChanges(); // dispara load() del constructor
    return { fixture, cmp: fixture.componentInstance as any };
  }

  /** Toma LA petición pendiente a /dashboard (una sola por cambio de período). */
  function take(): TestRequest {
    return httpMock.expectOne((r) => r.url.endsWith('/dashboard'));
  }
  /** Toma la petición y la responde (para avanzar el estado a `ready`). */
  function serve(over: Partial<DashboardData> = {}): void {
    take().flush({ msg: 'ok', data: makeData(over) });
  }
  function none(): void {
    httpMock.expectNone((r) => r.url.endsWith('/dashboard'));
  }

  afterEach(() => httpMock.verify());

  function assertPresetRange(r: TestRequest, days: number): void {
    const today = bogotaToday();
    expect(r.request.params.get('to')).toBe(today);
    expect(r.request.params.get('from')).toBe(addDays(today, -(days - 1)));
    expect(r.request.params.get('from')).toMatch(DATE_RE);
    expect(r.request.params.has('granularity')).toBe(false); // backend decide (día para <=92d)
  }

  it('preset por defecto = 30 días: from = hoy-29, to = hoy, sin granularity', () => {
    setup();
    const r = take();
    assertPresetRange(r, 30);
    r.flush({ msg: 'ok', data: makeData() });
  });

  it('preset 7 días', () => {
    const { cmp } = setup();
    serve();
    cmp.selectPreset('7d');
    const r = take();
    assertPresetRange(r, 7);
    r.flush({ msg: 'ok', data: makeData() });
  });

  it('preset 90 días', () => {
    const { cmp } = setup();
    serve();
    cmp.selectPreset('90d');
    const r = take();
    assertPresetRange(r, 90);
    r.flush({ msg: 'ok', data: makeData() });
  });

  it('fecha específica: from == to == fecha elegida, y granularity=day', () => {
    const { cmp } = setup();
    serve();
    cmp.onDateInput({ target: { value: '2020-06-15' } } as unknown as Event);
    const r = take();
    expect(r.request.params.get('from')).toBe('2020-06-15');
    expect(r.request.params.get('to')).toBe('2020-06-15');
    expect(r.request.params.get('granularity')).toBe('day');
    r.flush({ msg: 'ok', data: makeData() });
  });

  it('la fecha viaja como YYYY-MM-DD (nunca ISO con hora)', () => {
    const { cmp } = setup();
    serve();
    cmp.onDateInput({ target: { value: '2020-06-15' } } as unknown as Event);
    const r = take();
    expect(r.request.params.get('from')).toMatch(DATE_RE);
    expect(r.request.params.get('to')).toMatch(DATE_RE);
    r.flush({ msg: 'ok', data: makeData() });
  });

  it('fecha futura: bloqueada — no cambia la selección ni genera petición', () => {
    const { cmp } = setup();
    serve();
    cmp.enterDayMode(); // consulta HOY
    serve();
    expect(cmp.selectedDate()).toBe(bogotaToday());

    const future = addDays(bogotaToday(), 5);
    cmp.onDateInput({ target: { value: future } } as unknown as Event);
    none();
    expect(cmp.selectedDate()).toBe(bogotaToday());
    expect(cmp.maxDate).toBe(bogotaToday());
  });

  it('fecha específica -> preset: vuelve al rango y sale del modo fecha', () => {
    const { cmp } = setup();
    serve();
    cmp.onDateInput({ target: { value: '2020-06-15' } } as unknown as Event);
    serve();
    expect(cmp.isDayMode()).toBe(true);

    cmp.selectPreset('30d');
    const r = take();
    assertPresetRange(r, 30);
    expect(cmp.isDayMode()).toBe(false);
    r.flush({ msg: 'ok', data: makeData() });
  });

  it('preset -> fecha específica: entra en modo fecha y consulta el día de hoy', () => {
    const { cmp } = setup();
    serve();
    cmp.enterDayMode();
    const r = take();
    expect(r.request.params.get('from')).toBe(bogotaToday());
    expect(r.request.params.get('to')).toBe(bogotaToday());
    expect(r.request.params.get('granularity')).toBe('day');
    expect(cmp.isDayMode()).toBe(true);
    r.flush({ msg: 'ok', data: makeData() });
  });

  it('día sin datos (orders.total = 0): estado ready + aviso vacío, NUNCA error', () => {
    const { cmp } = setup();
    serve();
    cmp.onDateInput({ target: { value: '2020-06-15' } } as unknown as Event);
    serve({ orders: { total: 0, byStatus: makeData().orders.byStatus } });

    expect(cmp.state()).toBe('ready');
    expect(cmp.isEmptyPeriod()).toBe(true);
    expect(cmp.state()).not.toBe('error');
  });

  it('label del período: es-CO para la fecha, etiqueta del preset para el rango', () => {
    const { cmp } = setup();
    serve();

    cmp.onDateInput({ target: { value: '2026-08-15' } } as unknown as Event);
    serve();
    const dayLabel = cmp.periodLabel() as string;
    expect(dayLabel).toContain('agosto');
    expect(dayLabel).toContain('2026');
    expect(dayLabel).not.toContain('2026-08-15'); // nunca ISO

    cmp.selectPreset('7d');
    serve();
    expect(cmp.periodLabel()).toBe('Últimos 7 días');
  });

  it('no repite la misma petición: reelegir el preset activo o recargar igual -> sin request', () => {
    const { cmp } = setup();
    serve();

    cmp.selectPreset('30d'); // ya activo
    none();

    cmp.load(); // misma selección
    none();

    cmp.selectPreset('7d'); // distinto -> sí consulta
    serve();
  });
});
