import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '../../../environments/environment';
import { HttpAuth } from './http-auth';
import type { PublicProduct } from '../models/public-product.model';

/** Envoltura estándar `{ msg, data }` de las respuestas del backend. */
interface ApiEnvelope<T> {
  msg: string;
  data: T;
}

@Service()
export class HttpProduct {
    //Inyectar una dependencia usando el constructor
    //constructor( private http: httpClient){}
    //Inyectar una dependencia sin usar el constructor, implementarse en las funciones
    private http = inject(HttpClient);
    private authHttp = inject( HttpAuth);

    // Base del backend (coherente con http-category / http-auth). Antes estaba
    // hardcodeada como 'http://localhost:3000/api', lo que rompia el deploy.
    private BASE_URL: string = environment.apiUrl;

    //Crear una cabecera y va meter dentro de ella el token
    private getHeader(): HttpHeaders {
        //Obteniendo el token del GETTER del servicio http
        const token = this.authHttp.token;

        //Crea y retorna un Header de angular con el token y el nombre de la propiedad especificado en el Backend para recibir dicho valor 
        return new  HttpHeaders({
            'x-token': token || '',
            'content-type': 'application/json'
        });
    }

    //metodo para obtener todas las categorias
    createProduct( newProduct: any) {
        //http siempre devuelve los datos dentro de un Observable
        return this.http.post<any>( `${this.BASE_URL}/product`, newProduct, { headers: this.getHeader() } );
    }

    // F7 — tipado a `PublicProduct[]`: este método SOLO lo consume el
    // storefront (sin `?all=true`), así que el backend SIEMPRE responde con
    // la proyección pública (`PUBLIC_PRODUCT_FIELDS`), nunca con el contrato
    // editorial completo — ver `product.services.js`/F7.AUDIT §4.
    getProduct() {
        return this.http.get<ApiEnvelope<PublicProduct[]>>( `${this.BASE_URL}/product`, { headers: this.getHeader() } );
    }

    deleteProduct( id: string | null) {
        //http siemprem devuelve los datos dentro de un Observable
        return this.http.delete<any>( `${this.BASE_URL}/product/${id}`, { headers: this.getHeader() } );
    }

    getProductById( id: string | null) {
        return this.http.get<ApiEnvelope<PublicProduct>>(`${this.BASE_URL}/product/${id}`,  { headers: this.getHeader() } );
    }

    updateProductById( id: string | null,  updateProduct: any ) {
        return this.http.patch<any>(`${this.BASE_URL}/product/${id}`, updateProduct,  { headers: this.getHeader() } ) ;
    }
}
