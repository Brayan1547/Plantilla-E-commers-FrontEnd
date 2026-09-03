import { HttpClient, HttpParams } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import type { AdminProduct, ApiEnvelope, ProductImage, ProductStatus, ProductVariant } from '../models/admin.models';
import { unwrap } from './api.util';

/**
 * Contrato real (`product.routes.js` / `product.model.js` / `productWorkflow.helper.js`):
 *   GET    /product?all=true[&status=X] -> { msg, data: Product[] }
 *          Vista de PANEL (requiere sesión admin-capable). administrador/
 *          shop_manager ven TODO el catálogo (cualquier status); editor ve
 *          SOLO sus propios productos (`createdBy`). Sin `all=true` el
 *          backend cae al contrato público (solo PUBLISHED+isActive) — por
 *          eso este cliente SIEMPRE pide `all=true`: es el cliente del panel.
 *   GET    /product/:id  -> { msg, data: Product }  completo si sos dueño/admin/shop_manager;
 *                            si no, la misma regla pública (404 si no está publicado).
 *   POST   /product      -> { msg, data: Product }  (admin | shop_manager | editor) — nace SIEMPRE en DRAFT
 *   PATCH  /product/:id  -> { msg, data: Product }  SOLO contenido editorial; los campos
 *                            realmente aceptados dependen de rol + status + ownership
 *                            (`editableFieldsFor` en el backend, NUNCA solo de lo que este cliente envíe).
 *   PATCH  /product/:id/status -> { msg, data: Product }  ÚNICA vía para mover el workflow
 *                            (`toStatus` + `rejectionReason` si aplica). Transiciones validadas
 *                            en backend contra `canTransitionProduct`.
 *   DELETE /product/:id  -> { msg, data: Product }  (admin | shop_manager)
 *
 * Modelo: name (2–100), slug (`^[a-z0-9-]+$`, único), description (≤500),
 * price (≥0), categories: ObjectId[] (N:M real — HOMBRE/MUJER son categorías,
 * nunca un campo `gender`), images: [{ url (req), isMain (bool) }],
 * variants: [{ sku, color, size?, stock }] (subdocumentos embebidos; SKU con
 * índice único parcial), stock (fuente de verdad solo si NO hay variantes;
 * si las hay, es un agregado derivado que el backend recalcula), status
 * (DRAFT|PENDING_REVIEW|APPROVED|REJECTED|PUBLISHED), isActive (bool,
 * independiente de status — ver Product Domain Design Proposal §8).
 */
export interface ProductPayload {
  name: string;
  slug: string;
  description?: string;
  price: number;
  stock?: number;
  images: ProductImage[];
  /** ObjectIds de categoría. Al menos 1 es obligatorio para poder enviar a revisión (no para guardar borrador). */
  categories: string[];
  variants?: ProductVariant[];
  /** Solo administrador/shop_manager pueden tocarlo vía PATCH normal (ver `editableFieldsFor`). */
  isActive?: boolean;
}

@Service()
export class AdminProductsApi {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/product`;

  /** Lista del PANEL: siempre `?all=true` (+ `status` opcional). Ver contrato arriba. */
  list(status?: ProductStatus): Observable<AdminProduct[]> {
    let params = new HttpParams().set('all', 'true');
    if (status) params = params.set('status', status);
    return this.http.get<ApiEnvelope<AdminProduct[]>>(this.base, { params }).pipe(unwrap());
  }

  getById(id: string): Observable<AdminProduct> {
    return this.http.get<ApiEnvelope<AdminProduct>>(`${this.base}/${id}`).pipe(unwrap());
  }

  create(payload: ProductPayload): Observable<AdminProduct> {
    return this.http.post<ApiEnvelope<AdminProduct>>(this.base, payload).pipe(unwrap());
  }

  update(id: string, payload: Partial<ProductPayload>): Observable<AdminProduct> {
    return this.http.patch<ApiEnvelope<AdminProduct>>(`${this.base}/${id}`, payload).pipe(unwrap());
  }

  /**
   * Transición de estado del workflow editorial. `rejectionReason` es
   * obligatorio (validado en backend) solo cuando `toStatus === 'REJECTED'`.
   */
  updateStatus(id: string, toStatus: ProductStatus, rejectionReason?: string): Observable<AdminProduct> {
    return this.http
      .patch<ApiEnvelope<AdminProduct>>(`${this.base}/${id}/status`, { toStatus, rejectionReason })
      .pipe(unwrap());
  }

  remove(id: string): Observable<AdminProduct> {
    return this.http.delete<ApiEnvelope<AdminProduct>>(`${this.base}/${id}`).pipe(unwrap());
  }
}
