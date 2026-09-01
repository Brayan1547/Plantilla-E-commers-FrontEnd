import { Routes } from '@angular/router';

import { adminGuard, adminChildGuard } from './core/guards/admin.guard';
import { permissionGuard } from './core/guards/permission.guard';

/**
 * Rutas del Admin Panel (lazy desde `/admin` en `app.routes.ts`).
 *
 * - `/admin/forbidden` va PRIMERO y SIN guards: es el destino cuando el guard
 *   deniega, así que no puede volver a pasar por el guard (evita bucle).
 * - El resto cuelga del shell (`AdminLayoutComponent`) protegido por
 *   `adminGuard` (sesión + capacidad administrativa) y `adminChildGuard`
 *   (revalida en cada navegación hija).
 * - Cada módulo declara `data.permissions`; `permissionGuard` los exige al
 *   entrar. La autoridad REAL sigue siendo el backend.
 */
export const ADMIN_ROUTES: Routes = [
  {
    path: 'forbidden',
    loadComponent: () => import('./pages/forbidden/forbidden'),
    data: { breadcrumb: 'Acceso restringido' },
  },
  {
    path: '',
    canActivate: [adminGuard],
    canActivateChild: [adminChildGuard],
    loadComponent: () => import('./layout/admin-layout').then((m) => m.AdminLayoutComponent),
    data: { breadcrumb: 'Admin' },
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'overview' },
      {
        path: 'overview',
        loadComponent: () => import('./pages/overview/overview'),
        canActivate: [permissionGuard],
        data: { breadcrumb: 'Inicio', permissions: ['dashboard.read'] },
      },
      {
        path: 'products',
        loadChildren: () => import('./features/products/products.routes').then((m) => m.PRODUCTS_ROUTES),
        canActivate: [permissionGuard],
        data: { breadcrumb: 'Productos', permissions: ['products.read'] },
      },
      {
        path: 'inventory',
        loadComponent: () => import('./features/inventory/inventory.page'),
        canActivate: [permissionGuard],
        data: { breadcrumb: 'Inventario', permissions: ['inventory.read'] },
      },
      {
        path: 'categories',
        loadChildren: () =>
          import('./features/categories/categories.routes').then((m) => m.CATEGORIES_ROUTES),
        canActivate: [permissionGuard],
        data: { breadcrumb: 'Categorías', permissions: ['categories.read'] },
      },
      {
        path: 'users',
        loadChildren: () => import('./features/users/users.routes').then((m) => m.USERS_ROUTES),
        canActivate: [permissionGuard],
        data: { breadcrumb: 'Usuarios', permissions: ['users.read'] },
      },
      {
        path: 'roles',
        loadComponent: () => import('./features/roles/roles.page'),
        canActivate: [permissionGuard],
        data: { breadcrumb: 'Roles', permissions: ['roles.read'] },
      },
      { path: '**', redirectTo: 'overview' },
    ],
  },
];
