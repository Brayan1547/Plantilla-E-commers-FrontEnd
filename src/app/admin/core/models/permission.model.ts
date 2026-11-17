/**
 * Catálogo de permisos del Admin Panel (DUSCK).
 *
 * IMPORTANTE — el frontend NO es el mecanismo de seguridad. El backend
 * (`autentication.middleware.js` + `requireAdmin` / `authorizationUser` +
 * `productWorkflow.helper.js` -> `canTransitionProduct`/`editableFieldsFor`)
 * es la autoridad real. Este catálogo solo decide qué se MUESTRA y qué rutas
 * se pueden activar en el cliente.
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

  // Productos (product.routes.js -> ['administrador','shop_manager','editor'])
  'products.read',
  'products.create',
  'products.update',
  'products.delete',
  // Workflow editorial (PATCH /product/:id/status) — cada paso es un permiso
  // aparte porque cada rol tiene una porción distinta de la maquina de estados:
  'products.submitReview', // DRAFT/REJECTED -> PENDING_REVIEW (editor dueño, shop_manager, admin)
  'products.approve', // PENDING_REVIEW -> APPROVED (solo admin)
  // F6 — PENDING_REVIEW -> CHANGES_REQUESTED (solo admin; `requiresComment`
  // en `PRODUCT_TRANSITIONS`). shop_manager NUNCA la gana (ver
  // product-fase1.test.js "shop_manager NO gana request_changes").
  'products.requestChanges',
  'products.reject', // PENDING_REVIEW -> REJECTED (solo admin)
  'products.publish', // APPROVED -> PUBLISHED (solo admin)
  // Activar/desactivar (`isActive`) es una palanca OPERATIVA, no editorial —
  // `editableFieldsFor` en el backend la deja fuera de lo que un `editor`
  // puede tocar (el editor no publica, y esta palanca es publish-adjacente).
  'products.toggleActive',

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

  // Pedidos (UI-5.1 — order.routes.js -> autenticationUser +
  // authorizationUser(['administrador','shop_manager']) para las 4 rutas:
  // GET /api/orders, GET /api/orders/:id, PATCH /:id/status, PATCH /:id/payment).
  // El backend NO tiene permisos granulares: los 3 permisos se otorgan/retiran
  // en bloque con el rol. Se dejan separados para poder ocultar acciones
  // concretas en la UI y para migrar sin fricción cuando exista `/me/permissions`.
  'orders.read',
  'orders.manageStatus',
  'orders.managePayment',

  // Dashboard — agregados de solo lectura sobre los recursos anteriores
  'dashboard.read',
  // Deudas: solo administrador
  'debts.read',
  'debts.create',
  'debts.update',
  'debts.delete',
  'debts.addPayment',
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
 *  - `administrador`: acceso total, incluida la aprobación/publicación.
 *  - `shop_manager`: catálogo (productos/categorías/inventario) + dashboard +
 *    enviar a revisión — PERO NUNCA aprobar/rechazar/publicar (Decisión
 *    funcional §2: la aprobación y publicación son exclusivas del administrador).
 *  - `editor`: crear/editar productos PROPIOS y enviarlos a revisión. Sin
 *    acceso a usuarios/roles/carritos/categorías/inventario/dashboard, y sin
 *    autoridad de aprobación/publicación bajo ninguna circunstancia.
 *  - `subscriber`: ningún endpoint administrativo -> sin acceso al panel.
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
    'products.submitReview',
    'products.toggleActive',
    'inventory.read',
    'categories.read',
    'categories.create',
    'categories.update',
    'categories.delete',
    // UI-5.1 — shop_manager gestiona pedidos (mismo rol que en el backend).
    'orders.read',
    'orders.manageStatus',
    'orders.managePayment',
    'dashboard.read',
  ],
  // 'dashboard.read' incluido porque `/admin` redirige por defecto a
  // `overview` (el lanzador de módulos, sin datos sensibles: la pagina ya
  // filtra que modulos mostrar segun `perms.canAny`) — sin este permiso el
  // editor no tendria ninguna pantalla de aterrizaje al entrar al panel.
  editor: [
    'products.read',
    'products.create',
    'products.update',
    'products.submitReview',
    'dashboard.read',
  ],
  subscriber: [],
};

/** Roles que pueden entrar al panel (tienen al menos un permiso administrativo). */
export const ADMIN_CAPABLE_ROLES: AdminRole[] = (
  Object.keys(ROLE_PERMISSIONS) as AdminRole[]
).filter((r) => ROLE_PERMISSIONS[r].length > 0);
