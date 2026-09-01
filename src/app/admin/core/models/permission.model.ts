/**
 * Catálogo de permisos del Admin Panel (DUSCK).
 *
 * IMPORTANTE — el frontend NO es el mecanismo de seguridad. El backend
 * (`autentication.middleware.js` + `requireAdmin` / `authorizationUser`) es la
 * autoridad real. Este catálogo solo decide qué se MUESTRA y qué rutas se
 * pueden activar en el cliente.
 *
 * Cada permiso se deriva de un endpoint REAL existente hoy. Cuando el backend
 * incorpore un sistema de permisos granulares, este archivo pasa a alimentarse
 * de `GET /roles` (o `/me/permissions`) sin cambiar el resto del panel: los
 * guards y componentes ya consultan `PermissionsService`, no el rol directo.
 */
export const PERMISSIONS = [
  // Usuarios — todos admin-only (user.routes.js -> requireAdmin)
  'users.read',
  'users.create',
  'users.update',
  'users.delete',
  'users.manageRole', // PATCH /users/:id/role
  'users.manageStatus', // PATCH /users/:id/status

  // Roles — solo lectura (role.routes.js -> authorizationUser(['administrador']))
  'roles.read',

  // Productos (product.routes.js -> ['administrador','shop_manager'])
  'products.read',
  'products.create',
  'products.update',
  'products.delete',

  // Inventario — vista derivada de productos (mismo contrato)
  'inventory.read',

  // Categorías (category.routes.js -> ['administrador','shop_manager'])
  'categories.read',
  'categories.create',
  'categories.update',
  'categories.delete',

  // Carrito administrativo (cart.routes.js -> /cart/admin -> ['administrador'])
  'carts.readAny',
  'carts.deleteAny',

  // Dashboard — agregados de solo lectura sobre los recursos anteriores
  'dashboard.read',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/** Roles REALES del backend (`src/config/global.config.js` + enum del modelo). */
export type AdminRole = 'administrador' | 'shop_manager' | 'editor' | 'subscriber';

export const ROLE_LABELS: Record<AdminRole, string> = {
  administrador: 'Administrador',
  shop_manager: 'Gestor de tienda',
  editor: 'Editor',
  subscriber: 'Suscriptor',
};

/**
 * Mapa rol -> permisos. Refleja EXACTAMENTE lo que cada rol puede hacer contra
 * la API hoy:
 *  - `administrador`: acceso total.
 *  - `shop_manager`: catálogo (productos/categorías/inventario) + dashboard.
 *  - `editor` / `subscriber`: NINGÚN endpoint administrativo -> sin acceso al panel.
 *
 * Estructurado como listas para que sea trivial migrar a permisos por-rol
 * servidos desde el backend.
 */
export const ROLE_PERMISSIONS: Record<AdminRole, Permission[]> = {
  administrador: [...PERMISSIONS],
  shop_manager: [
    'products.read',
    'products.create',
    'products.update',
    'products.delete',
    'inventory.read',
    'categories.read',
    'categories.create',
    'categories.update',
    'categories.delete',
    'dashboard.read',
  ],
  editor: [],
  subscriber: [],
};

/** Roles que pueden entrar al panel (tienen al menos un permiso administrativo). */
export const ADMIN_CAPABLE_ROLES: AdminRole[] = (
  Object.keys(ROLE_PERMISSIONS) as AdminRole[]
).filter((r) => ROLE_PERMISSIONS[r].length > 0);
