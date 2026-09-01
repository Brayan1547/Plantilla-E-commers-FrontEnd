import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';

import { AdminProductsApi } from '../../core/services/admin-products.api';
import { AdminCategoriesApi } from '../../core/services/admin-categories.api';
import { AdminDialog } from '../../core/services/admin-dialog';
import { PermissionsService } from '../../core/services/permissions';
import { normalizeError } from '../../core/services/api-error';
import {
  categoryId,
  mainImageUrl,
  stockLevel,
  STOCK_LOW_THRESHOLD,
  type AdminCategory,
  type AdminProduct,
  type LoadState,
} from '../../core/models/admin.models';

import { PageHeaderComponent } from '../../shared/ui/page-header/page-header';
import { IconComponent } from '../../shared/ui/icon/icon';
import { StatusBadgeComponent } from '../../shared/ui/status-badge/status-badge';
import { PaginationComponent } from '../../shared/ui/pagination/pagination';
import { DataTableComponent, type SortState, type TableColumn } from '../../shared/ui/data-table/data-table';
import { processList } from '../../shared/util/list.util';
import { formatCurrencyCOP } from '../../shared/util/format.util';

const COLUMNS: TableColumn[] = [
  { label: '', width: '52px' },
  { key: 'name', label: 'Producto' },
  { label: 'Categoría', width: '150px' },
  { key: 'price', label: 'Precio', width: '120px', align: 'right' },
  { key: 'stock', label: 'Stock', width: '120px' },
  { key: 'isActive', label: 'Estado', width: '110px' },
  { label: '', width: '150px' },
];

@Component({
  selector: 'adm-product-list',
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
  templateUrl: './product-list.page.html',
})
export default class ProductListPage {
  private api = inject(AdminProductsApi);
  private categoriesApi = inject(AdminCategoriesApi);
  private dialog = inject(AdminDialog);
  private router = inject(Router);
  protected perms = inject(PermissionsService);

  protected readonly columns = COLUMNS;
  protected readonly lowThreshold = STOCK_LOW_THRESHOLD;
  protected readonly formatCurrency = formatCurrencyCOP;
  protected readonly mainImage = mainImageUrl;
  protected readonly stockLevel = stockLevel;

  private all = signal<AdminProduct[]>([]);
  private categories = signal<AdminCategory[]>([]);
  protected state = signal<LoadState>('loading');
  protected errorMsg = signal('');
  protected busyId = signal<string | null>(null);

  protected search = signal('');
  protected categoryFilter = signal<string>('');
  protected statusFilter = signal<'' | 'active' | 'inactive'>('');
  protected stockFilter = signal<'' | 'ok' | 'low' | 'out'>('');
  protected sort = signal<SortState | null>({ key: 'name', dir: 'asc' });
  protected page = signal(1);
  protected readonly pageSize = 10;

  private categoryMap = computed(() => {
    const map = new Map<string, string>();
    for (const c of this.categories()) map.set(c._id, c.name);
    return map;
  });

  protected categoryName(product: AdminProduct): string {
    const id = categoryId(product.category);
    return (id && this.categoryMap().get(id)) || 'Sin categoría';
  }

  protected view = computed(() =>
    processList(this.all(), {
      search: this.search(),
      searchFields: ['name', 'slug', 'description'],
      filters: [
        (p) => (this.categoryFilter() ? categoryId(p.category) === this.categoryFilter() : true),
        (p) =>
          this.statusFilter() === ''
            ? true
            : this.statusFilter() === 'active'
              ? p.isActive
              : !p.isActive,
        (p) => (this.stockFilter() ? stockLevel(p.stock) === this.stockFilter() : true),
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

  protected categoryOptions = computed(() => this.categories());

  constructor() {
    this.load();
  }

  load(): void {
    this.state.set('loading');
    forkJoin({
      products: this.api.list(),
      categories: this.categoriesApi.list().pipe(catchError(() => of([] as AdminCategory[]))),
    })
      .pipe(catchError((err) => (this.fail(err), of(null))))
      .subscribe((res) => {
        if (!res) return;
        this.categories.set(res.categories);
        this.all.set(res.products);
        this.state.set(res.products.length ? 'ready' : 'empty');
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
    this.categoryFilter.set('');
    this.statusFilter.set('');
    this.stockFilter.set('');
    this.page.set(1);
  }

  toggleActive(product: AdminProduct): void {
    this.busyId.set(product._id);
    this.api.update(product._id, { isActive: !product.isActive }).subscribe({
      next: (updated) => {
        this.all.update((list) => list.map((p) => (p._id === updated._id ? updated : p)));
        this.busyId.set(null);
        this.dialog.success(updated.isActive ? 'Producto activado.' : 'Producto desactivado.');
      },
      error: (err) => {
        this.busyId.set(null);
        this.dialog.error(normalizeError(err).message);
      },
    });
  }

  async remove(product: AdminProduct): Promise<void> {
    const ok = await this.dialog.confirm({
      title: 'Eliminar producto',
      message: `Se eliminará "${product.name}". Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      tone: 'danger',
    });
    if (!ok) return;
    this.api.remove(product._id).subscribe({
      next: () => {
        this.dialog.success('Producto eliminado.');
        this.all.update((list) => list.filter((p) => p._id !== product._id));
        if (!this.all().length) this.state.set('empty');
      },
      error: (err) => this.dialog.error(normalizeError(err).message),
    });
  }

  goNew(): void {
    this.router.navigate(['/admin/products/new']);
  }
}
