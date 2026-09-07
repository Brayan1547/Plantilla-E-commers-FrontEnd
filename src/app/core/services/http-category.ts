import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '../../../environments/environment';
import { HttpAuth } from './http-auth';
import type { PublicCategory } from '../models/public-product.model';

/** Envoltura estándar `{ msg, data }` de las respuestas del backend. */
interface ApiEnvelope<T> {
  msg: string;
  data: T;
}

@Service()
export class HttpCategory {
    //Inyectar una dependencia
    private http = inject(HttpClient);
    private authHttp = inject(HttpAuth);

    BASE_URL: string = environment.apiUrl;

        private getHeader(): HttpHeaders {
        const token = this.authHttp.token;
        return new HttpHeaders({
            'x-token': token || '',
            'content-type': 'application/json'
        });
    }

    createCategory(newCategory: any ) {
        return this.http.post(`${ this.BASE_URL}/category`, newCategory, { headers: this.getHeader() });
    }

    // F7-C / F7-CLOSURE — servicio del STOREFRONT. Nunca añade `?all=true`, así
    // que el backend responde SIEMPRE el contrato público (solo `isActive:true`)
    // — incluso si el `authInterceptor` global adjunta un `x-token` válido de un
    // usuario admin-capable (recibir sesión NO basta: el gate del backend exige
    // `?all=true` + rol, igual que `GET /product`). El panel admin usa
    // `AdminCategoriesApi` (que sí pide `?all=true`), no este servicio.
    getCategory() {
        return this.http.get<ApiEnvelope<PublicCategory[]>>( `${ this.BASE_URL}/category` );
    }

    getCategoryById(id: any) {
        return this.http.get( `${ this.BASE_URL}/category/${id}`);
    }

    deleteCategoryById(id: string) {
        return this.http.delete(`${ this.BASE_URL}/category/${id}`, { headers: this.getHeader() });
    }

    updateCategotyById(id: string, updateCategotyById: any) {
        return this.http.patch(`${ this.BASE_URL}/category/${id}`, updateCategotyById, { headers: this.getHeader() } );
    }
}
