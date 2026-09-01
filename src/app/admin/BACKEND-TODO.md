# Admin Panel — Backend pendiente

Contratos que el Admin Panel necesita y que **hoy no existen**. Nada de esto está
implementado en el frontend con datos ficticios: las pantallas afectadas muestran
un estado explícito de "no disponible / requiere backend".

## Prioridad alta (mejoran módulos ya entregados)

| Necesidad | Endpoint sugerido | Método | Payload / respuesta | Motivo |
|---|---|---|---|---|
| Paginación server-side | `GET /users`, `/product`, `/category` | GET | `?page&limit&sort&q` → `{ data, total, page, pages }` | hoy devuelven el arreglo completo; no escala |
| Anti-lockout en borrado de usuario | `DELETE /users/:id` | DELETE | rechazar auto-borrado y borrado del último `administrador` (400) | `PATCH /:id/role` y `/:id/status` ya lo hacen; `DELETE` no |
| Categoría poblada en productos | `GET /product`, `/product/:id` | GET | `category` como objeto `{ _id, name, slug }` (o `?populate=category`) | hoy llega como ObjectId; el nombre se resuelve en cliente |
| Subida de imágenes de producto | `POST /product/:id/images` o `/uploads` | POST | multipart → `{ url }` | el editor actual es solo-URL |
| Detalle de usuario enriquecido | `GET /users/:id/orders`, `/addresses`, `/activity` | GET | historial de compras, órdenes, direcciones, última actividad | no hay modelos |

## Módulo de inventario real

La pantalla `Inventario` actual es **solo una vista derivada de `GET /product`**
(campo `stock`). Un inventario real necesita modelos/endpoints para:

- variantes de producto (talla, color) y **SKU por variante**
- **stock por variante** y por ubicación/almacén
- **stock mínimo** configurable por producto/variante (hoy el umbral es una
  constante del frontend, `STOCK_LOW_THRESHOLD = 5`)
- **stock reservado** vs. **disponible**
- **movimientos** de inventario: entradas, salidas, ajustes, transferencias
- **historial / auditoría** de movimientos (quién, cuándo, motivo)
- proveedores y órdenes de compra

## Dominios sin backend (no iniciados)

Pedidos, envíos, devoluciones/reembolsos, cupones, campañas/banners,
fidelización, pagos, finanzas, impuestos, PQRS/soporte, reseñas, auditoría
(activity logs), backups, salud del sistema, centro de notificaciones, búsqueda
global, analítica/tráfico. El dashboard de métricas de ventas depende de un
modelo de pedidos inexistente.
