import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';

@Service()
export class HttpCategory {
    //Inyectar una dependencia 
    private http = inject(HttpClient);

    createCategory(newCategory: any ) { 
        return this.http.post('http://localhost:3000/api/category', newCategory);
    }
    
    getCategory() {
        //Observable (HttpClient)
        return this.http.get<any>( 'http://localhost:3000/api/category' );
    }

    getCategoryById(id: string) {
        return this.http.get( `http://localhost:3000/api/category/${id}`);
    }

    deleteCategoryById(id: string) {
        return this.http.delete(`http://localhost:3000/api/category/${id}`);
    }

    updateCategotyById(id: string, updateCategotyById: any) {
        return this.http.patch(`http://localhost:3000/api/category/${id}`, updateCategotyById);
    }
}
