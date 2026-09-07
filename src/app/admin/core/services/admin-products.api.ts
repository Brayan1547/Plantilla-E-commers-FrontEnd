import { HttpClient, HttpParams } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable, switchMap } from 'rxjs';

import { environment } from '../../../../environments/environment';
import type {
  AdminProduct,
  ApiEnvelope,
  ModelInfo,
  ProductImage,
  ProductStatus,
  ProductVariant,
} from '../models/admin.models';
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
 * variants: [{ sku, color, size, stock }] (subdocumentos embebidos; SKU con
 * índice único parcial; `size` OBLIGATORIO desde F5-CLOSURE — "Única" para
 * productos sin tallaje, nunca vacío), stock (fuente de verdad solo si NO hay variantes;
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
  // FASE 1 del backend — contenido editorial. Opcionales para guardar borrador;
  // exigidos por el backend (`collectSubmitReviewErrors`) para enviar a revisión.
  details?: string;
  shippingInfo?: string;
  returnsInfo?: string;
  /** `heightCm` numérico en centímetros; nunca "1.87 m" (ver F3 §6). */
  modelInfo?: ModelInfo;
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
   * Transición de estado del workflow editorial. `comment` es obligatorio
   * (validado en backend, `requiresComment` en `PRODUCT_TRANSITIONS`) para
   * `toStatus === 'REJECTED'` y `toStatus === 'CHANGES_REQUESTED'` (F6). Se
   * envía como `comment` — el campo canónico del backend
   * (`productWorkflow.helper.js`); `rejectionReason` sigue existiendo ahí
   * solo como alias de compatibilidad, ya no hace falta enviarlo desde aquí.
   */
  updateStatus(id: string, toStatus: ProductStatus, comment?: string): Observable<AdminProduct> {
    return this.http
      .patch<ApiEnvelope<AdminProduct>>(`${this.base}/${id}/status`, { toStatus, comment })
      .pipe(unwrap());
  }

  /**
   * "Enviar / reenviar a revisión" desde la perspectiva del editor.
   *
   * El contrato REAL del backend (`PRODUCT_TRANSITIONS`) NO tiene una arista
   * `REJECTED -> PENDING_REVIEW` directa (decisión F1 §7: un rechazo se reabre
   * pasando por DRAFT). Para `CHANGES_REQUESTED` sí existe el reenvío directo.
   * Este método encapsula esa diferencia:
   *   · DRAFT / CHANGES_REQUESTED  -> PENDING_REVIEW  (1 request)
   *   · REJECTED                    -> DRAFT -> PENDING_REVIEW  (2 requests encadenados)
   * No inventa transiciones: solo compone aristas legítimas existentes.
   */
  submitToReview(id: string, fromStatus: ProductStatus): Observable<AdminProduct> {
    if (fromStatus === 'REJECTED') {
      return this.updateStatus(id, 'DRAFT').pipe(switchMap(() => this.updateStatus(id, 'PENDING_REVIEW')));
    }
    return this.updateStatus(id, 'PENDING_REVIEW');
  }

  remove(id: string): Observable<AdminProduct> {
    return this.http.delete<ApiEnvelope<AdminProduct>>(`${this.base}/${id}`).pipe(unwrap());
  }

  /**
   * FASE 4 — Upload REAL de una imagen (multipart), intermediado por backend
   * hacia Cloudinary (`POST /product/:id/images`). El backend es la única
   * autoridad de ownership/estado — este cliente no valida nada de eso, solo
   * transporta el archivo. Devuelve el PRODUCTO COMPLETO actualizado (con la
   * imagen ya persistida, `_id` real incluido).
   */
  uploadImage(id: string, file: File): Observable<AdminProduct> {
    const form = new FormData();
    form.append('image', file, file.name);
    return this.http
      .post<ApiEnvelope<AdminProduct>>(`${this.base}/${id}/images`, form)
      .pipe(unwrap());
  }

  /**
   * FASE 4 — Borrado REAL de una imagen ya persistida (`DELETE
   * /product/:id/images/:imageId`). `imageId` es el `_id` del subdocumento
   * (nunca el `publicId` de Cloudinary, que el frontend ni siquiera necesita
   * conocer). Devuelve el producto actualizado.
   */
  deleteImage(id: string, imageId: string): Observable<AdminProduct> {
    return this.http
      .delete<ApiEnvelope<AdminProduct>>(`${this.base}/${id}/images/${imageId}`)
      .pipe(unwrap());
  }
}
