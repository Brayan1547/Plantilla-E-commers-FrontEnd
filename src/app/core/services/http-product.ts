import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';

@Service()
export class HttpProduct {
    //Inyectar una dependencia usando el constructor
    //co
    private http = inject(HttpClient);
}
