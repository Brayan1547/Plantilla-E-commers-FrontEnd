import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import type { AdminCategory, ApiEnvelope } from '../models/admin.models';
import { unwrap } from './api.util';

/**
 * Contrato real (`category.routes.js` / `category.model.js`):
 *   GET    /category            -> { msg, data: Category[] }  contrato público (solo isActive:true)
 *   GET    /category?all=true   -> { msg, data: Category[] }  activas + inactivas — SOLO con rol
 *                                  admin-capable (administrador|shop_manager|editor); si no,
 *                                  degrada al contrato público (nunca 403). Mismo gate que
 *                                  GET /product?all=true.
 *   GET    /category/:id            -> { msg, data: Category } contrato público (inactiva -> 404)
 *   GET    /category/:id?all=true   -> { msg, data: Category } permite una inactiva con rol admin-capable
 *   POST   /category      -> { msg, data: Category }      (admin | shop_manager)
 *   PATCH  /category/:id  -> { msg, data: Category }      whitelist: name,slug,description,isActive
 *   DELETE /category/:id  -> { msg, data: Category }       409 si algún producto la usa (`categories[]`)
 *
 * F7-CLOSURE — este servicio es el del PANEL: siempre pide `?all=true` en los
 * GET de lectura (list/getById) para poder ver y editar también las inactivas.
 * El token lo adjunta `authInterceptor`. El storefront usa `HttpCategory`
 * (sin `?all=true`) y por tanto nunca recibe inactivas, aunque haya sesión.
 *
 * Modelo: name (2–50, único), slug (`^[a-z0-9-]+$`, único), description (≤250),
 * isActive (bool, default true). Sin jerarquía/subcategorías/atributos.
 *
 * Product Domain: un producto pertenece a VARIAS categorías a la vez
 * (`Product.categories: ObjectId[]`) — HOMBRE/MUJER son categorías igual que
 * CAMISETAS/PANTALONES, nunca un campo `gender` aparte. Este servicio no
 * cambia de forma por eso; solo lo consume `AdminProductsApi`.
 */
export interface CategoryPayload {
  name: string;
  slug: string;
  description?: string;
  isActive: boolean;
}

@Service()
export class AdminCategoriesApi {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/category`;

  list(): Observable<AdminCategory[]> {
    return this.http
      .get<ApiEnvelope<AdminCategory[]>>(this.base, { params: { all: 'true' } })
      .pipe(unwrap());
  }

  getById(id: string): Observable<AdminCategory> {
    return this.http
      .get<ApiEnvelope<AdminCategory>>(`${this.base}/${id}`, { params: { all: 'true' } })
      .pipe(unwrap());
  }

  create(payload: CategoryPayload): Observable<AdminCategory> {
    return this.http.post<ApiEnvelope<AdminCategory>>(this.base, payload).pipe(unwrap());
  }

  update(id: string, payload: Partial<CategoryPayload>): Observable<AdminCategory> {
    return this.http.patch<ApiEnvelope<AdminCategory>>(`${this.base}/${id}`, payload).pipe(unwrap());
  }

    /** POST /category/:id/image (multipart, campo `image`) — sube/reemplaza la portada. */
  uploadImage(id: string, file: File): Observable<AdminCategory> {
    const form = new FormData();
    form.append('image', file, file.name);
    return this.http.post<ApiEnvelope<AdminCategory>>(`${this.base}/${id}/image`, form).pipe(unwrap());
  }

  /** DELETE /category/:id/image — quita la portada. */
  deleteImage(id: string): Observable<AdminCategory> {
    return this.http.delete<ApiEnvelope<AdminCategory>>(`${this.base}/${id}/image`).pipe(unwrap());
  }

  remove(id: string): Observable<AdminCategory> {
    return this.http.delete<ApiEnvelope<AdminCategory>>(`${this.base}/${id}`).pipe(unwrap());
  }
}
