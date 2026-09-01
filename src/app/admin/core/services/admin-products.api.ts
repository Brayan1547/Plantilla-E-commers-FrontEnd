import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import type { AdminProduct, ApiEnvelope, ProductImage } from '../models/admin.models';
import { unwrap } from './api.util';

/**
 * Contrato real (`product.routes.js` / `product.model.js`):
 *   GET    /product      -> { msg, data: Product[] }   (público; category SIN poblar -> string id)
 *   GET    /product/:id  -> { msg, data: Product }      (category SIN poblar)
 *   POST   /product      -> { msg, data: Product }      (admin | shop_manager)
 *   PATCH  /product/:id  -> { msg, data: Product }      whitelist:
 *                            name,slug,description,price,stock,images,category,isActive
 *   DELETE /product/:id  -> { msg, data: Product }
 *
 * Modelo: name (2–100), slug (`^[a-z0-9-]+$`, único), description (≤500),
 * price (≥0), stock (≥0), images: [{ url (req), isMain (bool) }], category
 * (ObjectId ref, req), isActive (bool). SIN variantes/tallas/colores/SKU.
 */
export interface ProductPayload {
  name: string;
  slug: string;
  description?: string;
  price: number;
  stock: number;
  images: ProductImage[];
  /** ObjectId de la categoría. */
  category: string;
  isActive: boolean;
}

@Service()
export class AdminProductsApi {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/product`;

  list(): Observable<AdminProduct[]> {
    return this.http.get<ApiEnvelope<AdminProduct[]>>(this.base).pipe(unwrap());
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

  remove(id: string): Observable<AdminProduct> {
    return this.http.delete<ApiEnvelope<AdminProduct>>(`${this.base}/${id}`).pipe(unwrap());
  }
}
