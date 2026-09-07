import { ChangeDetectionStrategy, Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';

import { AdminOrdersApi } from '../../core/services/admin-orders.api';
import { PermissionsService } from '../../core/services/permissions';
import { normalizeError } from '../../core/services/api-error';
import type { LoadState } from '../../core/models/admin.models';
import {
  EMAIL_RE,
  ORDER_NUMBER_RE,
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  orderStatusLabel,
  orderStatusTone,
  paymentMethodLabel,
  paymentStatusLabel,
  paymentStatusTone,
  type AdminOrderListItem,
  type AdminOrderPagination,
  type AdminOrderQuery,
  type OrderStatus,
} from '../../core/models/admin-order.model';

import { PageHeaderComponent } from '../../shared/ui/page-header/page-header';
import { StatusBadgeComponent } from '../../shared/ui/status-badge/status-badge';
import { PaginationComponent } from '../../shared/ui/pagination/pagination';
import {
  DataTableComponent,
  type SortState,
  type TableColumn,
} from '../../shared/ui/data-table/data-table';
import { formatDateTime, formatCurrencyCOP } from '../../shared/util/format.util';

const COLUMNS: TableColumn[] = [
  { label: '#', width: '48px', align: 'right' },
  { key: 'orderNumber', label: 'Pedido' },
  { label: 'Cliente' },
  { key: 'createdAt', label: 'Fecha', width: '160px' },
  { label: 'Total', align: 'right', width: '130px' },
  { key: 'status', label: 'Estado', width: '190px' },
  { label: 'Pago', width: '150px' },
  { label: '', width: '80px' },
];

const PAGE_SIZE = 20; // = límite por defecto del backend (`LIST_DEFAULT_LIMIT`)

/** key de columna del data-table -> campo `?sort=` que el backend acepta. */
const SORT_MAP: Record<string, AdminOrderQuery['sort']> = {
  orderNumber: 'orderNumber',
  status: 'status',
  createdAt: 'createdAt',
};

@Component({
  selector: 'adm-order-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    RouterLink,
    PageHeaderComponent,
    StatusBadgeComponent,
    PaginationComponent,
    DataTableComponent,
  ],
  templateUrl: './order-list.page.html',
})
export default class OrderListPage implements OnDestroy {
  private api = inject(AdminOrdersApi);
  protected perms = inject(PermissionsService);

  protected readonly columns = COLUMNS;
  protected readonly pageSize = PAGE_SIZE;
  protected readonly statusList = ORDER_STATUSES;
  protected readonly statusLabels = ORDER_STATUS_LABELS;
  protected readonly orderStatusLabel = orderStatusLabel;
  protected readonly orderStatusTone = orderStatusTone;
  protected readonly paymentStatusLabel = paymentStatusLabel;
  protected readonly paymentStatusTone = paymentStatusTone;
  protected readonly paymentMethodLabel = paymentMethodLabel;
  protected readonly formatDateTime = formatDateTime;
  protected readonly formatCurrency = formatCurrencyCOP;

  protected orders = signal<AdminOrderListItem[]>([]);
  protected pagination = signal<AdminOrderPagination | null>(null);
  protected state = signal<LoadState>('loading');
  protected errorMsg = signal('');

  // --- Filtros (server-side; el backend soporta paginación + filtros) --------
  protected statusFilter = signal<'' | OrderStatus>('');
  protected orderNumberInput = signal('');
  protected emailInput = signal('');
  protected dateFrom = signal('');
  protected dateTo = signal('');
  protected sort = signal<SortState>({ key: 'createdAt', dir: 'desc' });
  protected page = signal(1);

  /** `orderNumber` solo se envía si tiene el formato EXACTO que el backend valida. */
  protected orderNumberInvalid = computed(() => {
    const v = this.orderNumberInput().trim();
    return v.length > 0 && !ORDER_NUMBER_RE.test(v);
  });
  /** `customerEmail` solo se envía si parece un correo. */
  protected emailInvalid = computed(() => {
    const v = this.emailInput().trim();
    return v.length > 0 && !EMAIL_RE.test(v);
  });

  protected tableState = computed<LoadState>(() => {
    if (this.state() !== 'ready') return this.state();
    return this.orders().length === 0 ? 'empty' : 'ready';
  });

  private reloadTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.load();
  }

  ngOnDestroy(): void {
    if (this.reloadTimer) clearTimeout(this.reloadTimer);
  }

  private buildQuery(): AdminOrderQuery {
    const q: AdminOrderQuery = {
      page: this.page(),
      limit: PAGE_SIZE,
      sort: SORT_MAP[this.sort().key] ?? 'createdAt',
      order: this.sort().dir,
    };
    if (this.statusFilter()) q.status = this.statusFilter() as OrderStatus;

    const on = this.orderNumberInput().trim().toUpperCase();
    if (on && ORDER_NUMBER_RE.test(on)) q.orderNumber = on;

    const email = this.emailInput().trim();
    if (email && EMAIL_RE.test(email)) q.customerEmail = email;

    if (this.dateFrom()) q.createdFrom = this.dateFrom();
    if (this.dateTo()) q.createdTo = this.dateTo();
    return q;
  }

  load(): void {
    this.state.set('loading');
    this.api
      .list(this.buildQuery())
      .pipe(catchError((err) => (this.fail(err), of(null))))
      .subscribe((res) => {
        if (!res) return;
        this.orders.set(res.items ?? []);
        this.pagination.set(res.pagination ?? null);
        // El backend puede corregir la página (fuera de rango) -> reflejarlo.
        if (res.pagination && res.pagination.page !== this.page()) {
          this.page.set(res.pagination.page);
        }
        this.state.set('ready');
      });
  }

  private fail(err: unknown): void {
    this.errorMsg.set(normalizeError(err).message);
    this.state.set('error');
  }

  /** Cambio de filtro de texto: recarga con debounce para no golpear la API por tecla. */
  protected queueReload(): void {
    this.page.set(1);
    if (this.reloadTimer) clearTimeout(this.reloadTimer);
    this.reloadTimer = setTimeout(() => this.load(), 350);
  }

  /** Cambio de filtro discreto (select / fecha): recarga inmediata. */
  protected reloadNow(): void {
    this.page.set(1);
    this.load();
  }

  protected onSort(s: SortState): void {
    if (!SORT_MAP[s.key]) return; // columna no ordenable en el backend
    this.sort.set(s);
    this.page.set(1);
    this.load();
  }

  protected onPage(p: number): void {
    this.page.set(p);
    this.load();
  }

  protected resetFilters(): void {
    this.statusFilter.set('');
    this.orderNumberInput.set('');
    this.emailInput.set('');
    this.dateFrom.set('');
    this.dateTo.set('');
    this.sort.set({ key: 'createdAt', dir: 'desc' });
    this.reloadNow();
  }

  protected rowIndex(i: number): number {
    return (this.page() - 1) * PAGE_SIZE + i + 1;
  }
}
