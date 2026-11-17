import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';

import { AdminDebtsApi } from '../../core/services/admin-debts.api';
import { AdminDialog } from '../../core/services/admin-dialog';
import { PermissionsService } from '../../core/services/permissions';
import { normalizeError } from '../../core/services/api-error';
import type { LoadState } from '../../core/models/admin.models';
import {
  DEBT_DIRECTION_LABELS,
  DEBT_STATUS_LABELS,
  type Debt,
  type DebtDirection,
} from '../../core/models/debt.model';

import { PageHeaderComponent } from '../../shared/ui/page-header/page-header';
import { IconComponent } from '../../shared/ui/icon/icon';
import { KpiCardComponent } from '../../shared/ui/kpi-card/kpi-card';
import { StatusBadgeComponent, type BadgeTone } from '../../shared/ui/status-badge/status-badge';
import { PaginationComponent } from '../../shared/ui/pagination/pagination';
import { DataTableComponent, type SortState, type TableColumn } from '../../shared/ui/data-table/data-table';
import { processList } from '../../shared/util/list.util';
import { formatCurrencyCOP, formatDateOnly } from '../../shared/util/format.util';

type StatusFilter = 'OPEN' | 'OVERDUE' | 'PAGADA' | '';

const COLUMNS: TableColumn[] = [
  { key: 'personName', label: 'Persona' },
  { key: 'direction', label: 'Tipo', width: '110px' },
  { label: 'Concepto' },
  { key: 'amount', label: 'Monto', align: 'right', width: '120px' },
  { key: 'balance', label: 'Saldo', align: 'right', width: '120px' },
  { key: 'dueDate', label: 'Vence', width: '120px' },
  { key: 'status', label: 'Estado', width: '120px' },
  { label: '', width: '130px' },
];

@Component({
  selector: 'adm-debt-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    RouterLink,
    PageHeaderComponent,
    IconComponent,
    KpiCardComponent,
    StatusBadgeComponent,
    PaginationComponent,
    DataTableComponent,
  ],
  templateUrl: './debt-list.page.html',
})
export default class DebtListPage {
  private api = inject(AdminDebtsApi);
  private dialog = inject(AdminDialog);
  private router = inject(Router);
  protected perms = inject(PermissionsService);

  protected readonly columns = COLUMNS;
  protected readonly money = formatCurrencyCOP;
  protected readonly formatDateOnly = formatDateOnly;
  protected readonly statusLabels = DEBT_STATUS_LABELS;

  private all = signal<Debt[]>([]);
  protected state = signal<LoadState>('loading');
  protected errorMsg = signal('');

  protected search = signal('');
  protected directionFilter = signal<DebtDirection | ''>('');
  protected statusFilter = signal<StatusFilter>('OPEN');
  protected sort = signal<SortState | null>({ key: 'dueDate', dir: 'asc' });
  protected page = signal(1);
  protected readonly pageSize = 10;

  /** Tarjetas: solo cuentan deudas con saldo pendiente. */
  protected summary = computed(() => {
    const open = this.all().filter((d) => d.status !== 'PAGADA');
    const sum = (dir: DebtDirection) => {
      const list = open.filter((d) => d.direction === dir);
      return {
        total: list.reduce((acc, d) => acc + d.balance, 0),
        count: list.length,
        overdue: list.filter((d) => d.overdue).length,
      };
    };
    return { meDeben: sum('ME_DEBEN'), yoDebo: sum('YO_DEBO') };
  });

  protected view = computed(() =>
    processList(this.all(), {
      search: this.search(),
      searchFields: ['personName', 'concept', 'personPhone'],
      filters: [
        (d) => (this.directionFilter() ? d.direction === this.directionFilter() : true),
        (d) => {
          switch (this.statusFilter()) {
            case 'OPEN':
              return d.status !== 'PAGADA';
            case 'OVERDUE':
              return d.overdue;
            case 'PAGADA':
              return d.status === 'PAGADA';
            default:
              return true;
          }
        },
      ],
      sort: this.sort(),
      page: this.page(),
      pageSize: this.pageSize,
    }),
  );

  protected tableState = computed<LoadState>(() => {
    if (this.state() !== 'ready') return this.state();
    return this.view().total === 0 ? 'empty' : 'ready';
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.state.set('loading');
    this.api
      .list()
      .pipe(catchError((err) => (this.fail(err), of(null))))
      .subscribe((debts) => {
        if (debts === null) return;
        this.all.set(debts);
        this.state.set('ready');
      });
  }

  private fail(err: unknown): void {
    this.errorMsg.set(normalizeError(err).message);
    this.state.set('error');
  }

  onSort(s: SortState): void {
    this.sort.set(s);
    this.page.set(1);
  }

  resetFilters(): void {
    this.search.set('');
    this.directionFilter.set('');
    this.statusFilter.set('OPEN');
    this.page.set(1);
  }

  protected directionLabel(dir: DebtDirection): string {
    return DEBT_DIRECTION_LABELS[dir];
  }

  protected statusTone(d: Debt): BadgeTone {
    if (d.status === 'PAGADA') return 'ok';
    if (d.overdue) return 'danger';
    return d.status === 'PARCIAL' ? 'info' : 'warn';
  }

  protected statusText(d: Debt): string {
    return d.overdue ? 'Vencida' : DEBT_STATUS_LABELS[d.status];
  }

  async remove(debt: Debt): Promise<void> {
    const ok = await this.dialog.confirm({
      title: 'Eliminar deuda',
      message: `Se eliminará la deuda de "${debt.personName}" con todos sus abonos. Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      tone: 'danger',
    });
    if (!ok) return;
    this.api.remove(debt._id).subscribe({
      next: () => {
        this.dialog.success('Deuda eliminada.');
        this.all.update((list) => list.filter((d) => d._id !== debt._id));
      },
      error: (err) => this.dialog.error(normalizeError(err).message),
    });
  }

  goNew(): void {
    this.router.navigate(['/admin/debts/new']);
  }
}
