import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';

import { AdminCategoriesApi } from '../../core/services/admin-categories.api';
import { AdminDialog } from '../../core/services/admin-dialog';
import { PermissionsService } from '../../core/services/permissions';
import { normalizeError } from '../../core/services/api-error';
import type { AdminCategory, LoadState } from '../../core/models/admin.models';

import { PageHeaderComponent } from '../../shared/ui/page-header/page-header';
import { IconComponent } from '../../shared/ui/icon/icon';
import { StatusBadgeComponent } from '../../shared/ui/status-badge/status-badge';
import { PaginationComponent } from '../../shared/ui/pagination/pagination';
import { DataTableComponent, type SortState, type TableColumn } from '../../shared/ui/data-table/data-table';
import { processList } from '../../shared/util/list.util';
import { formatDate } from '../../shared/util/format.util';

const COLUMNS: TableColumn[] = [
  { key: 'name', label: 'Nombre' },
  { key: 'slug', label: 'Slug', width: '180px' },
  { label: 'Descripción' },
  { key: 'isActive', label: 'Estado', width: '110px' },
  { key: 'updatedAt', label: 'Actualizada', width: '130px' },
  { label: '', width: '170px' },
];

@Component({
  selector: 'adm-category-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    RouterLink,
    PageHeaderComponent,
    IconComponent,
    StatusBadgeComponent,
    PaginationComponent,
    DataTableComponent,
  ],
  templateUrl: './category-list.page.html',
})
export default class CategoryListPage {
  private api = inject(AdminCategoriesApi);
  private dialog = inject(AdminDialog);
  private router = inject(Router);
  protected perms = inject(PermissionsService);

  protected readonly columns = COLUMNS;
  protected readonly formatDate = formatDate;

  private all = signal<AdminCategory[]>([]);
  protected state = signal<LoadState>('loading');
  protected errorMsg = signal('');
  protected busyId = signal<string | null>(null);

  protected search = signal('');
  protected statusFilter = signal<'' | 'active' | 'inactive'>('');
  protected sort = signal<SortState | null>({ key: 'name', dir: 'asc' });
  protected page = signal(1);
  protected readonly pageSize = 10;

  protected view = computed(() =>
    processList(this.all(), {
      search: this.search(),
      searchFields: ['name', 'slug', 'description'],
      filters: [
        (c) =>
          this.statusFilter() === ''
            ? true
            : this.statusFilter() === 'active'
              ? c.isActive
              : !c.isActive,
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
      .subscribe((cats) => {
        if (cats === null) return;
        this.all.set(cats);
        this.state.set(cats.length ? 'ready' : 'empty');
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
    this.statusFilter.set('');
    this.page.set(1);
  }

  toggleActive(cat: AdminCategory): void {
    this.busyId.set(cat._id);
    this.api.update(cat._id, { isActive: !cat.isActive }).subscribe({
      next: (updated) => {
        this.all.update((list) => list.map((c) => (c._id === updated._id ? updated : c)));
        this.busyId.set(null);
        this.dialog.success(updated.isActive ? 'Categoría activada.' : 'Categoría desactivada.');
      },
      error: (err) => {
        this.busyId.set(null);
        this.dialog.error(normalizeError(err).message);
      },
    });
  }

  async remove(cat: AdminCategory): Promise<void> {
    const ok = await this.dialog.confirm({
      title: 'Eliminar categoría',
      message: `Se eliminará "${cat.name}". Los productos que la referencian podrían quedar sin categoría válida.`,
      confirmText: 'Eliminar',
      tone: 'danger',
    });
    if (!ok) return;
    this.api.remove(cat._id).subscribe({
      next: () => {
        this.dialog.success('Categoría eliminada.');
        this.all.update((list) => list.filter((c) => c._id !== cat._id));
        if (!this.all().length) this.state.set('empty');
      },
      error: (err) => this.dialog.error(normalizeError(err).message),
    });
  }

  goNew(): void {
    this.router.navigate(['/admin/categories/new']);
  }
}
