import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import type { AdminCategory, ApiEnvelope } from '../models/admin.models';
import { unwrap } from './api.util';

/**
 * Contrato real (`category.routes.js` / `category.model.js`):
 *   GET    /category      -> { msg, data: Category[] }   (público, sin auth)
 *   GET    /category/:id  -> { msg, data: Category }
 *   POST   /category      -> { msg, data: Category }      (admin | shop_manager)
 *   PATCH  /category/:id  -> { msg, data: Category }      whitelist: name,slug,description,isActive
 *   DELETE /category/:id  -> { msg, data: Category }
 *
 * Modelo: name (2–50, único), slug (`^[a-z0-9-]+$`, único), description (≤250),
 * isActive (bool, default true). Sin jerarquía/subcategorías/atributos.
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
    return this.http.get<ApiEnvelope<AdminCategory[]>>(this.base).pipe(unwrap());
  }

  getById(id: string): Observable<AdminCategory> {
    return this.http.get<ApiEnvelope<AdminCategory>>(`${this.base}/${id}`).pipe(unwrap());
  }

  create(payload: CategoryPayload): Observable<AdminCategory> {
    return this.http.post<ApiEnvelope<AdminCategory>>(this.base, payload).pipe(unwrap());
  }

  update(id: string, payload: Partial<CategoryPayload>): Observable<AdminCategory> {
    return this.http.patch<ApiEnvelope<AdminCategory>>(`${this.base}/${id}`, payload).pipe(unwrap());
  }

  remove(id: string): Observable<AdminCategory> {
    return this.http.delete<ApiEnvelope<AdminCategory>>(`${this.base}/${id}`).pipe(unwrap());
  }
}
