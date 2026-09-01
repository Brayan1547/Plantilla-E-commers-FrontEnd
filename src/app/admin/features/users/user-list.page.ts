import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';

import { AdminUsersApi } from '../../core/services/admin-users.api';
import { AdminRolesApi } from '../../core/services/admin-roles.api';
import { AdminDialog } from '../../core/services/admin-dialog';
import { PermissionsService } from '../../core/services/permissions';
import { HttpAuth } from '../../../core/services/http-auth';
import { normalizeError } from '../../core/services/api-error';
import { ROLE_LABELS, type AdminRole } from '../../core/models/permission.model';
import type { AdminUser, LoadState } from '../../core/models/admin.models';

import { PageHeaderComponent } from '../../shared/ui/page-header/page-header';
import { IconComponent } from '../../shared/ui/icon/icon';
import { StatusBadgeComponent } from '../../shared/ui/status-badge/status-badge';
import { PaginationComponent } from '../../shared/ui/pagination/pagination';
import { DataTableComponent, type SortState, type TableColumn } from '../../shared/ui/data-table/data-table';
import { processList } from '../../shared/util/list.util';
import { formatDate } from '../../shared/util/format.util';

const COLUMNS: TableColumn[] = [
  { label: '#', width: '48px', align: 'right' },
  { key: 'name', label: 'Nombre' },
  { key: 'nickname', label: 'Nickname' },
  { key: 'email', label: 'Correo' },
  { key: 'role', label: 'Rol', width: '150px' },
  { key: 'status', label: 'Estado', width: '110px' },
  { key: 'createdAt', label: 'Registro', width: '130px' },
  { label: '', width: '150px' },
];

@Component({
  selector: 'adm-user-list',
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
  templateUrl: './user-list.page.html',
})
export default class UserListPage {
  private api = inject(AdminUsersApi);
  private rolesApi = inject(AdminRolesApi);
  private dialog = inject(AdminDialog);
  private router = inject(Router);
  private auth = inject(HttpAuth);
  protected perms = inject(PermissionsService);

  protected readonly columns = COLUMNS;
  /** Opciones de rol desde `GET /roles` (con fallback local si falla). */
  protected readonly roleOptions = this.rolesApi.options;
  protected readonly formatDate = formatDate;

  protected roleName(id: string): string {
    return (
      this.roleOptions().find((r) => r.id === id)?.name ??
      ROLE_LABELS[id as AdminRole] ??
      id
    );
  }

  private all = signal<AdminUser[]>([]);
  protected state = signal<LoadState>('loading');
  protected errorMsg = signal('');

  protected search = signal('');
  protected roleFilter = signal<'' | AdminRole>('');
  protected statusFilter = signal<'' | 'active' | 'inactive'>('');
  protected dateFrom = signal('');
  protected sort = signal<SortState | null>({ key: 'createdAt', dir: 'desc' });
  protected page = signal(1);
  protected readonly pageSize = 10;

  private currentUser = toSignal(this.auth.user$, { initialValue: this.auth.user });
  protected currentUserId = computed(() => this.currentUser()?._id ?? null);

  protected view = computed(() => {
    const from = this.dateFrom() ? new Date(this.dateFrom()).getTime() : null;
    return processList(this.all(), {
      search: this.search(),
      searchFields: ['name', 'nickname', 'email'],
      filters: [
        (u) => (this.roleFilter() ? u.role === this.roleFilter() : true),
        (u) =>
          this.statusFilter() === ''
            ? true
            : this.statusFilter() === 'active'
              ? u.status
              : !u.status,
        (u) => (from ? new Date(u.createdAt ?? 0).getTime() >= from : true),
      ],
      sort: this.sort(),
      page: this.page(),
      pageSize: this.pageSize,
    });
  });

  /** `state` efectivo: si la carga fue OK pero el filtro no arroja filas -> empty. */
  protected tableState = computed<LoadState>(() => {
    if (this.state() !== 'ready') return this.state();
    return this.view().total === 0 ? 'empty' : 'ready';
  });

  constructor() {
    this.rolesApi.ensureLoaded();
    this.load();
  }

  load(): void {
    this.state.set('loading');
    this.api
      .list()
      .pipe(catchError((err) => (this.fail(err), of(null))))
      .subscribe((users) => {
        if (users === null) return;
        this.all.set(users);
        this.state.set(users.length ? 'ready' : 'empty');
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
    this.roleFilter.set('');
    this.statusFilter.set('');
    this.dateFrom.set('');
    this.page.set(1);
  }

  async remove(user: AdminUser): Promise<void> {
    if (user._id === this.currentUserId()) return;
    const ok = await this.dialog.confirm({
      title: 'Eliminar usuario',
      message: `Se eliminará la cuenta de "${user.name}" (${user.email}). Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      tone: 'danger',
    });
    if (!ok) return;

    this.api.remove(user._id).subscribe({
      next: () => {
        this.dialog.success('Usuario eliminado.');
        this.all.update((list) => list.filter((u) => u._id !== user._id));
        if (!this.all().length) this.state.set('empty');
      },
      error: (err) => this.dialog.error(normalizeError(err).message),
    });
  }

  goNew(): void {
    this.router.navigate(['/admin/users/new']);
  }
}
