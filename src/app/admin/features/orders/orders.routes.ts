import { Routes } from '@angular/router';

/**
 * UI-5.2 — Rutas del módulo administrativo de pedidos.
 *
 *   ''    -> listado (paginado/filtrado server-side)
 *   ':id' -> detalle + acciones de workflow / pago
 *
 * El permiso `orders.read` ya lo exige el `permissionGuard` del padre
 * (`admin.routes.ts`). Las acciones (status/pago) se ocultan por
 * `orders.manageStatus` / `orders.managePayment` dentro del detalle, y el
 * backend es la autoridad final (403 si el rol no corresponde).
 */
export const ORDERS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./order-list.page'),
  },
  {
    path: ':id',
    loadComponent: () => import('./order-detail.page'),
    data: { breadcrumb: 'Detalle' },
  },
];
