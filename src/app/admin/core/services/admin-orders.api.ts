import { HttpClient, HttpParams } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import type { ApiEnvelope } from '../models/admin.models';
import type {
  AdminOrderDetail,
  AdminOrderListResponse,
  AdminOrderQuery,
  OrderStatus,
  PaymentStatus,
} from '../models/admin-order.model';
import { unwrap } from './api.util';

/**
 * UI-5.2 — Cliente HTTP del módulo administrativo de pedidos.
 *
 * Contrato REAL (`Backend-Dusck/src/routes/order.routes.js`), todo tras
 * `autenticationUser` + `authorizationUser(['administrador','shop_manager'])`:
 *
 *   GET   /api/orders                -> { msg, data: { items, pagination } }
 *         query: page, limit(≤100), sort(createdAt|orderNumber|status),
 *                order(asc|desc), status, orderNumber(exacto DUSCK-AAAA-NNNNNN),
 *                userId, customerEmail(exacto), createdFrom, createdTo (YYYY-MM-DD | ISO)
 *   GET   /api/orders/:id            -> { msg, data: AdminOrderDetail }   (404 si skeleton/inexistente)
 *   PATCH /api/orders/:id/status     -> { msg, data: AdminOrderDetail }   body { status, note? }
 *   PATCH /api/orders/:id/payment    -> { msg, data: AdminOrderDetail }   body { status, note? }
 *
 * El `x-token` lo añade `authInterceptor`. Este servicio NO valida transiciones
 * ni roles: el backend es la autoridad. Solo transporta y desenvuelve `{ data }`.
 *
 * Punto ÚNICO de acceso HTTP a pedidos para el panel: los componentes de
 * listado y detalle consumen solo estos 4 métodos, nunca `HttpClient` directo.
 */
@Service()
export class AdminOrdersApi {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/orders`;

  /** Listado paginado + filtrado SERVER-SIDE (el backend soporta ambos). */
  list(query: AdminOrderQuery = {}): Observable<AdminOrderListResponse> {
    let params = new HttpParams();
    const set = (k: string, v: string | number | undefined) => {
      if (v !== undefined && v !== null && `${v}` !== '') params = params.set(k, `${v}`);
    };
    set('page', query.page);
    set('limit', query.limit);
    set('sort', query.sort);
    set('order', query.order);
    set('status', query.status);
    set('orderNumber', query.orderNumber);
    set('userId', query.userId);
    set('customerEmail', query.customerEmail);
    set('createdFrom', query.createdFrom);
    set('createdTo', query.createdTo);
    return this.http
      .get<ApiEnvelope<AdminOrderListResponse>>(this.base, { params })
      .pipe(unwrap());
  }

  getById(id: string): Observable<AdminOrderDetail> {
    return this.http.get<ApiEnvelope<AdminOrderDetail>>(`${this.base}/${id}`).pipe(unwrap());
  }

  /**
   * Transición del ciclo de vida del pedido. `note` es obligatoria para
   * `cancelled` (el backend responde 422 sin ella). La respuesta es el
   * detalle YA actualizado — el componente lo usa como refresco.
   */
  updateStatus(id: string, status: OrderStatus, note?: string): Observable<AdminOrderDetail> {
    const body: { status: OrderStatus; note?: string } = { status };
    if (note && note.trim()) body.note = note.trim();
    return this.http
      .patch<ApiEnvelope<AdminOrderDetail>>(`${this.base}/${id}/status`, body)
      .pipe(unwrap());
  }

  /**
   * Estado del cobro COD (`pending -> paid | failed`). Eje independiente de
   * `status`. `note` obligatoria para `failed`. Sin retrocesos (el backend
   * rechaza `paid -> *`).
   */
  updatePayment(id: string, status: PaymentStatus, note?: string): Observable<AdminOrderDetail> {
    const body: { status: PaymentStatus; note?: string } = { status };
    if (note && note.trim()) body.note = note.trim();
    return this.http
      .patch<ApiEnvelope<AdminOrderDetail>>(`${this.base}/${id}/payment`, body)
      .pipe(unwrap());
  }
}
