import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';

import { AdminDashboardApi } from './dashboard.api';
import {
  DEFAULT_PERIOD_SELECTION,
  RANGE_PRESETS,
  bogotaToday,
  queryKey,
  selectionLabel,
  selectionToQuery,
  type DashboardData,
  type PeriodSelection,
} from './dashboard.models';

import { HttpAuth } from '../../../core/services/http-auth';
import { PermissionsService } from '../../core/services/permissions';
import { ROLE_LABELS } from '../../core/models/permission.model';
import { ADMIN_NAV, type NavItem } from '../../layout/admin-nav';
import { normalizeError } from '../../core/services/api-error';
import type { LoadState } from '../../core/models/admin.models';

import { PageHeaderComponent } from '../../shared/ui/page-header/page-header';
import { IconComponent } from '../../shared/ui/icon/icon';
import { SkeletonComponent } from '../../shared/ui/states/skeleton';
import { ErrorStateComponent } from '../../shared/ui/states/error-state';

import { SummaryCardsComponent } from './components/summary-cards';
import { SalesChartComponent } from './components/sales-chart';
import { OrdersByStatusComponent } from './components/orders-by-status';
import { TopProductsComponent } from './components/top-products';
import { InventorySummaryComponent } from './components/inventory-summary';
import { OperationalAlertsComponent } from './components/operational-alerts';

/**
 * UI-5.3 / UI-5.4 — Dashboard principal del administrador.
 *
 * Reemplaza el placeholder "Panel de métricas". Consume UNA sola petición
 * (`GET /api/dashboard`) que entrega todas las métricas — sin fan-out.
 *
 * UI-5.4 — selector de período: presets (7/30/90 días) + "Fecha específica"
 * (calendario nativo `<input type="date">`, sin librería). Al elegir un día:
 * `from == to == YYYY-MM-DD`, `granularity=day`. El backend NO se modifica: ya
 * interpreta `YYYY-MM-DD` en America/Bogota y soporta `from == to`.
 *
 * Acceso: `administrador` / `shop_manager` (backend = autoridad). Un rol con
 * `dashboard.read` en el cliente pero SIN acceso en el backend (p. ej. `editor`)
 * recibe 403 y ve solo los accesos rápidos, no un error.
 *
 * Estados: loading (skeleton) · ready · forbidden (accesos rápidos) · error
 * (con reintento). 0 pedidos / 0 ventas NO es error: se muestran los ceros y un
 * aviso informativo (distinto del estado de error).
 */
@Component({
  selector: 'adm-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    PageHeaderComponent,
    IconComponent,
    SkeletonComponent,
    ErrorStateComponent,
    SummaryCardsComponent,
    SalesChartComponent,
    OrdersByStatusComponent,
    TopProductsComponent,
    InventorySummaryComponent,
    OperationalAlertsComponent,
  ],
  template: `
    <adm-page-header
      [title]="'Hola, ' + name()"
      subtitle="Panel de indicadores de la tienda. Datos reales de pedidos e inventario." />

    @if (state() !== 'forbidden') {
    <div
      class="adm-inline"
      role="group"
      aria-label="Período del panel"
      style="gap:8px 12px;margin-bottom:22px">
      <span
        style="font-size:var(--adm-fs-2xs);letter-spacing:.6px;text-transform:uppercase;color:var(--adm-ink-faint)">
        Período
      </span>

      @for (p of presets; track p.id) {
        <button
          type="button"
          class="adm-btn adm-btn--sm"
          [class.adm-btn--secondary]="!isPreset(p.id)"
          [attr.aria-pressed]="isPreset(p.id)"
          (click)="selectPreset(p.id)">
          {{ p.label }}
        </button>
      }

      <button
        type="button"
        class="adm-btn adm-btn--sm"
        [class.adm-btn--secondary]="!isDayMode()"
        [attr.aria-pressed]="isDayMode()"
        (click)="enterDayMode()">
        <adm-icon name="calendar" [size]="14" />
        Fecha específica
      </button>

      @if (isDayMode()) {
        <label style="display:inline-flex;align-items:center;gap:8px;margin:0">
          <span class="adm-sr-only">Elegir una fecha específica (máximo hoy)</span>
          <input
            type="date"
            class="adm-input"
            style="width:auto;min-width:150px"
            [max]="maxDate"
            [value]="selectedDate()"
            (change)="onDateInput($event)" />
        </label>
      }

      <span class="adm-note" aria-live="polite" style="margin-left:auto">
        Mostrando: <strong>{{ periodLabel() }}</strong>
      </span>
    </div>
    }

    @switch (state()) {
      @case ('loading') {
        <adm-skeleton variant="kpi" [count]="4" />
        <div style="height:16px"></div>
        <adm-skeleton variant="block" [height]="260" />
      }

      @case ('error') {
        <adm-error-state [message]="errorMsg()" (retry)="load(true)" />
      }

      @case ('ready') {
        @if (data(); as d) {
          @if (isEmptyPeriod()) {
            <div class="adm-callout" style="margin-bottom:20px">
              <span class="adm-callout__icon"><adm-icon name="info" [size]="18" /></span>
              <p>
                No se registraron pedidos para «{{ periodLabel() }}». Los indicadores
                muestran cero para este período.
              </p>
            </div>
          }

          <adm-dash-summary-cards [summary]="d.summary" />

          <div style="height:20px"></div>
          <adm-dash-sales-chart [series]="d.salesSeries" [granularity]="d.range.granularity" />

          <div class="adm-grid-2" style="margin-top:20px">
            <adm-dash-orders-summary [orders]="d.orders" />
            <adm-dash-top-products [products]="d.topProducts" />
          </div>

          <div class="adm-grid-2" style="margin-top:20px">
            <adm-dash-inventory-summary [inventory]="d.inventory" />
            <adm-dash-operational-alerts [alerts]="d.alerts" />
          </div>

          <p class="adm-note" style="margin-top:20px">
            Ventas = pedidos finalizados y no cancelados del período (checkout contra entrega:
            el pedido cuenta como venta al confirmarse). «Ingresos cobrados» refleja los pagos
            ya marcados como recibidos. El inventario es el estado ACTUAL del catálogo, no un
            histórico del período. No se incluyen métricas de tráfico, visitantes ni conversión:
            el backend no dispone de esos datos.
          </p>
        }
      }

      @case ('forbidden') {
        <div class="adm-card">
          <div class="adm-card__body adm-stack">
            <p class="adm-muted">
              Tu rol ({{ roleLabel() }}) no tiene acceso al panel de indicadores. Usa los
              accesos rápidos para ir a los módulos disponibles.
            </p>
          </div>
        </div>
      }
    }

    @if (state() === 'ready' || state() === 'forbidden') {
      <div style="margin-top:28px">
        <h2 style="margin-bottom:14px">Accesos rápidos</h2>
        <div class="adm-kpi-grid">
          @for (item of modules(); track item.route) {
            <a class="adm-kpi" [routerLink]="item.route" style="text-decoration:none">
              <span class="adm-inline">
                <span class="adm-nav-item__icon" style="color:var(--adm-accent)">
                  <adm-icon [name]="item.icon" [size]="20" />
                </span>
                <span class="adm-kpi__value adm-kpi__value--muted" style="font-size:16px;color:var(--adm-ink)">
                  {{ item.label }}
                </span>
              </span>
              <span class="adm-kpi__compare">Abrir módulo →</span>
            </a>
          }
        </div>
      </div>
    }
  `,
})
export default class DashboardPage {
  private api = inject(AdminDashboardApi);
  private perms = inject(PermissionsService);
  private auth = inject(HttpAuth);

  protected readonly presets = RANGE_PRESETS;
  /** Máximo seleccionable en el calendario: HOY en America/Bogota (sin futuros). */
  protected readonly maxDate = bogotaToday();

  protected state = signal<LoadState | 'forbidden'>('loading');
  protected data = signal<DashboardData | null>(null);
  protected errorMsg = signal('');
  protected selection = signal<PeriodSelection>(DEFAULT_PERIOD_SELECTION);

  /** Clave de la última query solicitada — evita repetir la misma petición. */
  private lastKey = '';

  private user = toSignal(this.auth.user$, { initialValue: this.auth.user });
  protected name = computed(() => (this.user()?.name ?? 'Administrador').split(' ')[0]);
  protected roleLabel = computed(() => {
    const r = this.perms.role();
    return r ? ROLE_LABELS[r] : '—';
  });

  protected isDayMode = computed(() => this.selection().kind === 'day');
  protected selectedDate = computed(() => {
    const s = this.selection();
    return s.kind === 'day' ? s.date : this.maxDate;
  });
  protected periodLabel = computed(() => selectionLabel(this.selection()));

  /** Período consultado con éxito pero sin ningún pedido: NO es un error. */
  protected isEmptyPeriod = computed(
    () => this.state() === 'ready' && (this.data()?.orders.total ?? 0) === 0,
  );

  protected modules = computed<NavItem[]>(() =>
    ADMIN_NAV.flatMap((s) => s.items).filter(
      (i) => i.route !== '/admin/overview' && this.perms.canAny(i.permissions),
    ),
  );

  constructor() {
    this.load();
  }

  protected isPreset(id: string): boolean {
    const s = this.selection();
    return s.kind === 'preset' && s.presetId === id;
  }

  protected selectPreset(id: string): void {
    if (this.isPreset(id)) return; // ya seleccionado -> sin request
    this.selection.set({ kind: 'preset', presetId: id });
    this.load();
  }

  protected enterDayMode(): void {
    if (this.selection().kind === 'day') return; // ya en modo fecha
    // Al abrir el calendario se consulta HOY por defecto; el usuario cambia la
    // fecha para consultar otro día.
    this.selection.set({ kind: 'day', date: this.maxDate });
    this.load();
  }

  protected onDateInput(ev: Event): void {
    const value = (ev.target as HTMLInputElement).value; // 'YYYY-MM-DD' o ''
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return; // input vacío / incompleto
    if (value > this.maxDate) return; // fecha futura: bloqueada
    const s = this.selection();
    if (s.kind === 'day' && s.date === value) return; // sin cambios -> sin request
    this.selection.set({ kind: 'day', date: value });
    this.load();
  }

  load(force = false): void {
    const query = selectionToQuery(this.selection());
    const key = queryKey(query);
    if (!force && key === this.lastKey && this.state() !== 'error') return;
    this.lastKey = key;

    this.state.set('loading');
    this.api
      .get(query)
      .pipe(catchError((err) => (this.fail(err), of(null))))
      .subscribe((res) => {
        if (!res) return;
        this.data.set(res);
        this.state.set('ready');
      });
  }

  private fail(err: unknown): void {
    const n = normalizeError(err);
    if (n.status === 403) {
      this.state.set('forbidden');
      return;
    }
    this.errorMsg.set(n.message);
    this.state.set('error');
  }
}
