import type { IconName } from '../shared/ui/icon/icon';
import type { Permission } from '../core/models/permission.model';

export interface NavItem {
  label: string;
  route: string;
  icon: IconName;
  /** Se muestra si el usuario tiene AL MENOS uno de estos permisos. */
  permissions: Permission[];
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

/**
 * Navegación del panel. SOLO se listan módulos con backend real hoy.
 * Los dominios sin API (cupones, finanzas, soporte, reseñas, auditoría,
 * backups, salud, notificaciones, analítica de ventas...) NO aparecen: se
 * añadirán cuando exista su contrato. Ver PENDING BACKEND en el informe.
 *
 * UI-5.2 — "Pedidos" SÍ tiene backend real (UI-5.1: GET/PATCH /api/orders).
 * UI-5.3 — el "Inicio" es ahora el Dashboard real (`GET /api/dashboard`):
 * resumen de ventas, serie temporal, pedidos por estado, top de productos,
 * inventario y alertas — todo agregado sobre pedidos e inventario existentes.
 * Sigue SIN datos de tráfico/visitantes/conversión (no existen en el dominio).
 *
 * La visibilidad de cada item la decide `PermissionsService` (derivado del rol);
 * la protección REAL de cada ruta la hace `permissionGuard` + el backend.
 */
export const ADMIN_NAV: NavSection[] = [
  {
    title: 'General',
    items: [
      {
        label: 'Inicio',
        route: '/admin/overview',
        icon: 'dashboard',
        permissions: ['dashboard.read'],
      },
    ],
  },
  {
    title: 'Ventas',
    items: [
      { label: 'Pedidos', route: '/admin/orders', icon: 'cart', permissions: ['orders.read'] },
    ],
  },
  {
    title: 'Catálogo',
    items: [
      { label: 'Productos', route: '/admin/products', icon: 'box', permissions: ['products.read'] },
      { label: 'Inventario', route: '/admin/inventory', icon: 'layers', permissions: ['inventory.read'] },
      { label: 'Categorías', route: '/admin/categories', icon: 'tag', permissions: ['categories.read'] },
    ],
  },
  {
    title: 'Personas',
    items: [
      { label: 'Usuarios', route: '/admin/users', icon: 'users', permissions: ['users.read'] },
      { label: 'Roles', route: '/admin/roles', icon: 'roles', permissions: ['roles.read'] },
    ],
  },
];
