import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';

@Service()
export class HttpCategory {
    //Inyectar una dependencia 
    private http = inject(HttpClient);

    createCategory(newCategory: any ) { 
        return this.http.post('http://localhost:3000/api/category', newCategory);
    }
}
