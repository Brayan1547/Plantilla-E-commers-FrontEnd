import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, forkJoin, of } from 'rxjs';

import { AdminProductsApi } from '../../core/services/admin-products.api';
import { AdminCategoriesApi } from '../../core/services/admin-categories.api';
import { AdminDialog } from '../../core/services/admin-dialog';
import { PermissionsService } from '../../core/services/permissions';
import { normalizeError } from '../../core/services/api-error';
import {
  categoryIds,
  mainImageUrl,
  stockLevel,
  STOCK_LOW_THRESHOLD,
  PRODUCT_STATUSES,
  PRODUCT_STATUS_LABELS,
  PRODUCT_STATUS_TONE,
  type AdminCategory,
  type AdminProduct,
  type LoadState,
  type ProductStatus,
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
  { label: 'Categorías', width: '160px' },
  { key: 'price', label: 'Precio', width: '110px', align: 'right' },
  { key: 'stock', label: 'Stock', width: '100px' },
  { label: 'Workflow', width: '130px' },
  { key: 'isActive', label: 'Activo', width: '90px' },
  { label: '', width: '230px' },
];

/**
 * Lista de productos del panel. Sirve DOS audiencias con el MISMO componente
 * (Regla §26 — no convertir el admin en un sistema gigantesco):
 *  - `editor`: ve solo sus propios productos (filtrado en backend) y puede
 *    crear/editar/enviar a revisión.
 *  - `administrador` / `shop_manager`: ven todo el catálogo; administrador
 *    además revisa (aprueba/rechaza/publica) — shop_manager NUNCA esas 3
 *    acciones (Decisión funcional §2).
 *
 * Todas las acciones de workflow llaman a `PATCH /product/:id/status`; la
 * validez real de cada transición la exige el backend (`canTransitionProduct`),
 * este componente solo oculta lo que fallaría con 403 para no confundir.
 */
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
  protected readonly statusOptions = PRODUCT_STATUSES;
  protected readonly statusLabels = PRODUCT_STATUS_LABELS;
  protected readonly statusTone = PRODUCT_STATUS_TONE;

  private all = signal<AdminProduct[]>([]);
  private categories = signal<AdminCategory[]>([]);
  protected state = signal<LoadState>('loading');
  protected errorMsg = signal('');
  protected busyId = signal<string | null>(null);

  protected search = signal('');
  protected categoryFilter = signal<string>('');
  protected statusFilter = signal<'' | ProductStatus>('');
  protected activeFilter = signal<'' | 'active' | 'inactive'>('');
  protected stockFilter = signal<'' | 'ok' | 'low' | 'out'>('');
  protected sort = signal<SortState | null>({ key: 'name', dir: 'asc' });
  protected page = signal(1);
  protected readonly pageSize = 10;

  private categoryMap = computed(() => {
    const map = new Map<string, string>();
    for (const c of this.categories()) map.set(c._id, c.name);
    return map;
  });

  protected categoryNames(product: AdminProduct): string {
    const names = categoryIds(product.categories)
      .map((id) => this.categoryMap().get(id))
      .filter((n): n is string => !!n);
    return names.length ? names.join(', ') : 'Sin categoría';
  }

  // `<ng-template #admRow let-p>` de adm-data-table no tipa `p` (llega como
  // `any`), así que indexar un `Record<ProductStatus, ...>` con `p.status`
  // directo en el HTML dispara TS7053. Envolver en un método con el parámetro
  // tipado resuelve el indexado sin perder el chequeo de tipos.
  protected statusLabel(product: AdminProduct): string {
    return PRODUCT_STATUS_LABELS[product.status];
  }
  protected statusToneOf(product: AdminProduct) {
    return PRODUCT_STATUS_TONE[product.status];
  }

  protected view = computed(() =>
    processList(this.all(), {
      search: this.search(),
      searchFields: ['name', 'slug', 'description'],
      filters: [
        (p) => (this.categoryFilter() ? categoryIds(p.categories).includes(this.categoryFilter()) : true),
        (p) => (this.statusFilter() ? p.status === this.statusFilter() : true),
        (p) =>
          this.activeFilter() === ''
            ? true
            : this.activeFilter() === 'active'
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
    this.activeFilter.set('');
    this.stockFilter.set('');
    this.page.set(1);
  }

  // --- Acciones de workflow ------------------------------------------------

  protected canSubmitReview(p: AdminProduct): boolean {
    return (p.status === 'DRAFT' || p.status === 'REJECTED') && this.perms.can('products.submitReview');
  }
  protected canApprove(p: AdminProduct): boolean {
    return p.status === 'PENDING_REVIEW' && this.perms.can('products.approve');
  }
  protected canReject(p: AdminProduct): boolean {
    return p.status === 'PENDING_REVIEW' && this.perms.can('products.reject');
  }
  protected canPublish(p: AdminProduct): boolean {
    return p.status === 'APPROVED' && this.perms.can('products.publish');
  }
  protected canToggleActive(): boolean {
    return this.perms.can('products.toggleActive');
  }

  private transition(p: AdminProduct, toStatus: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'PUBLISHED', rejectionReason?: string): void {
    this.busyId.set(p._id);
    this.api.updateStatus(p._id, toStatus, rejectionReason).subscribe({
      next: (updated) => {
        this.busyId.set(null);
        this.all.update((list) => list.map((x) => (x._id === updated._id ? updated : x)));
        this.dialog.success('Estado actualizado.');
      },
      error: (err) => {
        this.busyId.set(null);
        this.showTransitionError(err);
      },
    });
  }

  private showTransitionError(err: unknown): void {
    if (err instanceof HttpErrorResponse && Array.isArray(err.error?.errors) && err.error.errors.length) {
      this.dialog.error((err.error.errors as string[]).join(' · '));
      return;
    }
    this.dialog.error(normalizeError(err).message);
  }

  submitReview(p: AdminProduct): void {
    this.transition(p, 'PENDING_REVIEW');
  }

  approve(p: AdminProduct): void {
    this.transition(p, 'APPROVED');
  }

  async reject(p: AdminProduct): Promise<void> {
    const reason = await this.dialog.promptText({
      title: `Rechazar "${p.name}"`,
      message: 'Indica el motivo del rechazo. El editor lo verá para corregir y reenviar.',
      placeholder: 'Motivo del rechazo…',
      confirmText: 'Rechazar',
    });
    if (!reason) return;
    this.transition(p, 'REJECTED', reason);
  }

  publish(p: AdminProduct): void {
    this.transition(p, 'PUBLISHED');
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
