import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../../environments/environment.development';

@Injectable({
  providedIn: 'root'
})
export class HttpUsers {

  private http = inject(HttpClient);

  BASE_URL: string = environment.apiUrl;


  // Obtener todos los usuarios
  getUsers() {
    return this.http.get<any>(`${this.BASE_URL}/users`);
  }

  // Obtener un usuario por ID
  getUserById(id: string) {
    return this.http.get<any>(`${this.BASE_URL}/users/${id}`);
  }

  // Crear usuario
  createUser(newUser: any) {
    return this.http.post<any>(`${this.BASE_URL}/user`, newUser);
  }

  // Actualizar usuario
  updateUser(id: string, user: any) {
    return this.http.patch<any>(`${this.BASE_URL}/users/${id}`, user);
  }

  // Eliminar usuario
  deleteUser(id: string) {
    return this.http.delete<any>(`${this.BASE_URL}/users/${id}`);
  }

}   