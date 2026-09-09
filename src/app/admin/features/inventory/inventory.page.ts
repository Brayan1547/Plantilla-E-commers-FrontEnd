import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';

import { AdminProductsApi } from '../../core/services/admin-products.api';
import { AdminCategoriesApi } from '../../core/services/admin-categories.api';
import { normalizeError } from '../../core/services/api-error';
import {
  categoryIds,
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
  { key: 'stock', label: 'Stock', width: '90px', align: 'right' },
  // ETAPA E — corrección de copy: era 'Producto' (duplicado con la col. `name`,
  // además colisión de `track col.label` en el data-table). Solo el texto; `key`,
  // orden y filtrado intactos.
  { key: 'isActive', label: 'Estado', width: '110px' },
  { label: 'Nivel', width: '130px' },
  { label: '', width: '90px' },
];

/**
 * INVENTARIO = vista de solo lectura DERIVADA de `GET /product`.
 *
 * El backend NO tiene módulo de inventario propio: no hay variantes, SKU,
 * movimientos, ajustes, stock reservado, almacenes ni historial. El único dato
 * de existencias es `product.stock`. La edición del stock se hace en el
 * formulario de producto (`PATCH /product/:id`, contrato real). Ver BACKEND TODO.
 */
@Component({
  selector: 'adm-inventory-page',
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
  templateUrl: './inventory.page.html',
})
export default class InventoryPage {
  private api = inject(AdminProductsApi);
  private categoriesApi = inject(AdminCategoriesApi);

  protected readonly columns = COLUMNS;
  protected readonly lowThreshold = STOCK_LOW_THRESHOLD;
  protected readonly formatCurrency = formatCurrencyCOP;
  protected readonly mainImage = mainImageUrl;
  protected readonly stockLevel = stockLevel;

  private all = signal<AdminProduct[]>([]);
  private categories = signal<AdminCategory[]>([]);
  protected state = signal<LoadState>('loading');
  protected errorMsg = signal('');

  protected search = signal('');
  protected categoryFilter = signal('');
  protected levelFilter = signal<'' | 'ok' | 'low' | 'out'>('');
  protected statusFilter = signal<'' | 'active' | 'inactive'>('');
  protected sort = signal<SortState | null>({ key: 'stock', dir: 'asc' });
  protected page = signal(1);
  protected readonly pageSize = 12;

  private categoryMap = computed(() => {
    const map = new Map<string, string>();
    for (const c of this.categories()) map.set(c._id, c.name);
    return map;
  });

  protected categoryName(product: AdminProduct): string {
    const names = categoryIds(product.categories)
      .map((id) => this.categoryMap().get(id))
      .filter((n): n is string => !!n);
    return names.length ? names.join(', ') : 'Sin categoría';
  }

  /** Contadores globales (sobre todo el catálogo, no la página). */
  protected summary = computed(() => {
    const list = this.all();
    let ok = 0;
    let low = 0;
    let out = 0;
    for (const p of list) {
      const lvl = stockLevel(p.stock);
      if (lvl === 'out') out++;
      else if (lvl === 'low') low++;
      else ok++;
    }
    return { total: list.length, ok, low, out };
  });

  protected view = computed(() =>
    processList(this.all(), {
      search: this.search(),
      searchFields: ['name', 'slug'],
      filters: [
        (p) => (this.categoryFilter() ? categoryIds(p.categories).includes(this.categoryFilter()) : true),
        (p) => (this.levelFilter() ? stockLevel(p.stock) === this.levelFilter() : true),
        (p) =>
          this.statusFilter() === ''
            ? true
            : this.statusFilter() === 'active'
              ? p.isActive
              : !p.isActive,
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
    this.levelFilter.set('');
    this.statusFilter.set('');
    this.page.set(1);
  }
}
