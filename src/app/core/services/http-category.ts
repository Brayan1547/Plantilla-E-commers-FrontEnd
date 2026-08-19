import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '../../../environments/environment';
import { HttpAuth } from './http-auth';

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
    
    getCategory() {
        //Observable (HttpClient)
        return this.http.get<any>( `${ this.BASE_URL}/category` );
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
