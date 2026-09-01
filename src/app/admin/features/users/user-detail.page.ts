import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
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
import { SkeletonComponent } from '../../shared/ui/states/skeleton';
import { ErrorStateComponent } from '../../shared/ui/states/error-state';
import { formatDateTime } from '../../shared/util/format.util';

@Component({
  selector: 'adm-user-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    RouterLink,
    PageHeaderComponent,
    IconComponent,
    StatusBadgeComponent,
    SkeletonComponent,
    ErrorStateComponent,
  ],
  templateUrl: './user-detail.page.html',
})
export default class UserDetailPage {
  private api = inject(AdminUsersApi);
  private rolesApi = inject(AdminRolesApi);
  private dialog = inject(AdminDialog);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private auth = inject(HttpAuth);
  protected perms = inject(PermissionsService);

  private readonly userId = this.route.snapshot.paramMap.get('id') ?? '';

  /** Opciones de rol desde `GET /roles` (fallback local si falla). */
  protected readonly roleOptions = this.rolesApi.options;
  protected readonly formatDateTime = formatDateTime;

  protected roleName(id: string): string {
    return (
      this.roleOptions().find((r) => r.id === id)?.name ??
      ROLE_LABELS[id as AdminRole] ??
      id
    );
  }

  protected user = signal<AdminUser | null>(null);
  protected state = signal<LoadState>('loading');
  protected errorMsg = signal('');
  protected busy = signal(false);

  /** Rol seleccionado en el <select> (aún no enviado). */
  protected pendingRole = signal<AdminRole | null>(null);

  private currentUser = toSignal(this.auth.user$, { initialValue: this.auth.user });
  protected isSelf = computed(() => !!this.user() && this.user()!._id === this.currentUser()?._id);

  constructor() {
    this.rolesApi.ensureLoaded();
    this.load();
  }

  private load(): void {
    this.state.set('loading');
    this.api
      .getById(this.userId)
      .pipe(catchError((err) => (this.fail(err), of(null))))
      .subscribe((u) => {
        if (!u) return;
        this.user.set(u);
        this.pendingRole.set(u.role);
        this.state.set('ready');
      });
  }

  retry(): void {
    this.load();
  }

  private fail(err: unknown): void {
    this.errorMsg.set(normalizeError(err).message);
    this.state.set('error');
  }

  async saveRole(): Promise<void> {
    const u = this.user();
    const role = this.pendingRole();
    if (!u || !role || role === u.role || this.isSelf()) return;

    const ok = await this.dialog.confirm({
      title: 'Cambiar rol',
      message: `El rol de "${u.name}" pasará de ${this.roleName(u.role)} a ${this.roleName(role)}.`,
      confirmText: 'Cambiar rol',
    });
    if (!ok) return;

    this.busy.set(true);
    this.api.updateRole(u._id, role).subscribe({
      next: (updated) => {
        this.user.set(updated);
        this.pendingRole.set(updated.role);
        this.dialog.success('Rol actualizado.');
        this.busy.set(false);
      },
      error: (err) => {
        this.pendingRole.set(u.role);
        this.dialog.error(normalizeError(err).message);
        this.busy.set(false);
      },
    });
  }

  async toggleStatus(): Promise<void> {
    const u = this.user();
    if (!u || this.isSelf()) return;
    const next = !u.status;

    const ok = await this.dialog.confirm({
      title: next ? 'Reactivar cuenta' : 'Suspender cuenta',
      message: next
        ? `La cuenta de "${u.name}" volverá a estar activa y podrá iniciar sesión.`
        : `La cuenta de "${u.name}" quedará suspendida: no podrá iniciar sesión ni operar.`,
      confirmText: next ? 'Reactivar' : 'Suspender',
      tone: next ? 'default' : 'danger',
    });
    if (!ok) return;

    this.busy.set(true);
    this.api.updateStatus(u._id, next).subscribe({
      next: (updated) => {
        this.user.set(updated);
        this.dialog.success(next ? 'Cuenta reactivada.' : 'Cuenta suspendida.');
        this.busy.set(false);
      },
      error: (err) => {
        this.dialog.error(normalizeError(err).message);
        this.busy.set(false);
      },
    });
  }

  async remove(): Promise<void> {
    const u = this.user();
    if (!u || this.isSelf()) return;
    const ok = await this.dialog.confirm({
      title: 'Eliminar usuario',
      message: `Se eliminará la cuenta de "${u.name}" (${u.email}). Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      tone: 'danger',
    });
    if (!ok) return;

    this.busy.set(true);
    this.api.remove(u._id).subscribe({
      next: () => {
        this.dialog.success('Usuario eliminado.');
        this.router.navigate(['/admin/users']);
      },
      error: (err) => {
        this.dialog.error(normalizeError(err).message);
        this.busy.set(false);
      },
    });
  }
}
