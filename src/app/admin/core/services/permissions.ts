import { Service, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';

import { HttpAuth } from '../../../core/services/http-auth';
import {
  ADMIN_CAPABLE_ROLES,
  ROLE_PERMISSIONS,
  type AdminRole,
  type Permission,
} from '../models/permission.model';

/**
 * Fuente de verdad del cliente para "qué puede ver/activar el usuario actual".
 *
 * Deriva los permisos del rol que viene en la sesión (`HttpAuth`), que a su vez
 * se refresca desde `GET /auth/renew-token` (el backend recarga el rol desde la
 * BD en cada request protegida). El backend sigue siendo la autoridad: esto solo
 * evita mostrar acciones que fallarían con 403.
 *
 * Migración futura a permisos granulares: sustituir `permissionsForRole()` por
 * la lista que devuelva el backend (`/roles` enriquecido o `/me/permissions`).
 * El resto del panel no cambia porque consume `can()` / `permissions()`.
 */
@Service()
export class PermissionsService {
  private auth = inject(HttpAuth);

  /** Usuario actual como signal reactiva. */
  private user = toSignal(this.auth.user$, { initialValue: this.auth.user });

  readonly role = computed<AdminRole | null>(() => {
    const r = this.user()?.role as AdminRole | undefined;
    return r ?? null;
  });

  readonly permissions = computed<ReadonlySet<Permission>>(() => {
    const r = this.role();
    return new Set(r ? ROLE_PERMISSIONS[r] ?? [] : []);
  });

  /** ¿El usuario tiene rol con al menos un permiso administrativo? */
  readonly canAccessAdmin = computed<boolean>(() => {
    const r = this.role();
    return !!r && ADMIN_CAPABLE_ROLES.includes(r);
  });

  readonly isAuthenticated = computed<boolean>(() => !!this.user());

  /** Marca de "algo pasó" para forzar re-checks tras login en otra pestaña. */
  private tick = signal(0);
  refresh(): void {
    this.tick.update((n) => n + 1);
  }

  can(permission: Permission): boolean {
    return this.permissions().has(permission);
  }

  /** true si tiene AL MENOS UNO de los permisos indicados (o si la lista es vacía). */
  canAny(permissions: readonly Permission[]): boolean {
    if (!permissions.length) return true;
    const owned = this.permissions();
    return permissions.some((p) => owned.has(p));
  }

  canAll(permissions: readonly Permission[]): boolean {
    const owned = this.permissions();
    return permissions.every((p) => owned.has(p));
  }
}
