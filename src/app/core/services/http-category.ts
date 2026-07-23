import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '../../../environments/environment';

@Service()
export class HttpCategory {
    //Inyectar una dependencia 
    private http = inject(HttpClient);

    BASE_URL: string = environment.apiUrl;

    createCategory(newCategory: any ) { 
        return this.http.post(`${ this.BASE_URL}/category`, newCategory);
    }
    
    getCategory() {
        //Observable (HttpClient)
        return this.http.get<any>( `${ this.BASE_URL}/category` );
    }

    getCategoryById(id: any) {
        return this.http.get( `${ this.BASE_URL}/category/${id}`);
    }

    deleteCategoryById(id: string) {
        return this.http.delete(`${ this.BASE_URL}/category/${id}`);
    }

    updateCategotyById(id: string, updateCategotyById: any) {
        return this.http.patch(`${ this.BASE_URL}/category/${id}`, updateCategotyById);
    }
}
