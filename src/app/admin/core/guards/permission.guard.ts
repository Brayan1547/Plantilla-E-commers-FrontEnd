import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { PermissionsService } from '../services/permissions';
import type { Permission } from '../models/permission.model';

/**
 * Guard de permiso fino para rutas hijas ya dentro del panel (la sesión y la
 * capacidad administrativa ya las validó `adminChildGuard`).
 *
 * Uso:
 *   { path: 'users', canActivate: [permissionGuard], data: { permissions: ['users.read'] } }
 */
export const permissionGuard: CanActivateFn = (route) => {
  const perms = inject(PermissionsService);
  const router = inject(Router);

  const required = (route.data?.['permissions'] as Permission[] | undefined) ?? [];
  if (!required.length || perms.canAny(required)) {
    return true;
  }
  return router.createUrlTree(['/admin/forbidden']);
};
