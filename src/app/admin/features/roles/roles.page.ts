import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { catchError, of } from 'rxjs';

import { AdminRolesApi } from '../../core/services/admin-roles.api';
import { normalizeError } from '../../core/services/api-error';
import type { LoadState, RoleOption } from '../../core/models/admin.models';
import {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  type AdminRole,
  type Permission,
} from '../../core/models/permission.model';

import { PageHeaderComponent } from '../../shared/ui/page-header/page-header';
import { IconComponent } from '../../shared/ui/icon/icon';
import { SkeletonComponent } from '../../shared/ui/states/skeleton';
import { ErrorStateComponent } from '../../shared/ui/states/error-state';

@Component({
  selector: 'adm-roles-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, IconComponent, SkeletonComponent, ErrorStateComponent],
  templateUrl: './roles.page.html',
})
export default class RolesPage {
  private api = inject(AdminRolesApi);

  protected state = signal<LoadState>('loading');
  protected errorMsg = signal('');
  protected roles = signal<RoleOption[]>([]);

  protected readonly permissions = PERMISSIONS;

  /** Matriz rol×permiso DERIVADA en el cliente (no es RBAC del backend). */
  protected matrix = computed(() =>
    this.roles().map((role) => ({
      role,
      granted: new Set<Permission>(ROLE_PERMISSIONS[role.id as AdminRole] ?? []),
    })),
  );

  constructor() {
    this.load();
  }

  load(): void {
    this.state.set('loading');
    this.api
      .list()
      .pipe(
        catchError((err) => {
          this.errorMsg.set(normalizeError(err).message);
          this.state.set('error');
          return of(null);
        }),
      )
      .subscribe((roles) => {
        if (!roles) return;
        this.roles.set(roles);
        this.state.set(roles.length ? 'ready' : 'empty');
      });
  }
}
