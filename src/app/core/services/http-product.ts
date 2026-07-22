import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';

@Service()
export class HttpProduct {
    //Inyectar una dependencia usando el constructor
    //constructor( private http: httpClient){}
    //Inyectar una dependencia sin usar el constructor, implementarse en las funciones
    private http = inject(HttpClient);

    //metodo para obtener todas las categorias
    
    createProduct( newProduct: any) {
        //http siempre devuelve los datos dentro de un Observable
        return this.http.post( 'http://localhost:3000/api/product', newProduct);
    }

    getProduct() {
        //http siemprem devuelve los datos dentro de un Observable
        return this.http.get<any>( 'http://localhost:3000/api/product')
    }
}
