import { inject } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivateChildFn,
  CanActivateFn,
  Router,
  RouterStateSnapshot,
} from '@angular/router';
import { catchError, map, of } from 'rxjs';

import { HttpAuth } from '../../../core/services/http-auth';
import { PermissionsService } from '../services/permissions';
import { ADMIN_CAPABLE_ROLES, type AdminRole, type Permission } from '../models/permission.model';

/**
 * Guard raíz del Admin Panel.
 *
 * Flujo:
 *  1. `checkAuthStatus()` -> `GET /auth/renew-token`. Renueva token y confirma
 *     sesión viva contra el backend (no confía solo en sessionStorage).
 *  2. Sin sesión / token expirado  -> `/login?returnUrl=...` (401 lo maneja
 *     además el `authInterceptor`).
 *  3. Sesión válida pero rol sin capacidad administrativa -> `/admin/forbidden`.
 *
 * La autorización real vive en el backend; esto solo evita cargar UI inútil.
 */
export const adminGuard: CanActivateFn = (route, state) => {
  return checkAdminAccess(route, state);
};

export const adminChildGuard: CanActivateChildFn = (route, state) => {
  return checkAdminAccess(route, state);
};

function checkAdminAccess(route: ActivatedRouteSnapshot, state: RouterStateSnapshot) {
  const auth = inject(HttpAuth);
  const perms = inject(PermissionsService);
  const router = inject(Router);

  return auth.checkAuthStatus().pipe(
    map((isAuthenticated) => {
      if (!isAuthenticated) {
        return router.createUrlTree(['/login'], {
          queryParams: { returnUrl: state.url },
        });
      }

      const role = auth.user?.role as AdminRole | undefined;
      if (!role || !ADMIN_CAPABLE_ROLES.includes(role)) {
        return router.createUrlTree(['/admin/forbidden']);
      }

      // Permisos declarados en la ruta (route.data.permissions: Permission[]).
      const required = (route.data?.['permissions'] as Permission[] | undefined) ?? [];
      if (required.length && !perms.canAny(required)) {
        return router.createUrlTree(['/admin/forbidden']);
      }

      return true;
    }),
    catchError(() =>
      of(
        router.createUrlTree(['/login'], {
          queryParams: { returnUrl: state.url },
        }),
      ),
    ),
  );
}
