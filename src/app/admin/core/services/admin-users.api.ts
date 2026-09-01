import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import type { AdminRole } from '../models/permission.model';
import type { AdminUser, ApiEnvelope } from '../models/admin.models';
import { unwrap } from './api.util';

/**
 * Cliente tipado para el módulo de usuarios del panel.
 * Contrato real (`Backend-Dusck/src/routes/user.routes.js`), todo admin-only:
 *   GET    /users            -> { msg, data: User[] }         (arreglo completo, sin password)
 *   GET    /users/:id        -> { msg, data: User }
 *   POST   /users            -> { msg, data: User }           (name,nickname,email,password,avatar,role,status)
 *   PATCH  /users/:id        -> { msg, data: User }           SOLO perfil (name,nickname,email,password,avatar)
 *   PATCH  /users/:id/role   -> { msg, data: User }           body { role }        (anti-lockout en backend)
 *   PATCH  /users/:id/status -> { msg, data: User }           body { status:bool } (anti-lockout en backend)
 *   DELETE /users/:id        -> { msg, data: User }
 *
 * El token lo añade `authInterceptor` (cabecera `x-token`). No se envían
 * cabeceras manuales.
 */
export interface CreateUserPayload {
  name: string;
  nickname: string;
  email: string;
  password: string;
  role: AdminRole;
  status: boolean;
  avatar?: string;
}

/** Solo campos de perfil — el backend ignora role/status en este endpoint. */
export interface UpdateProfilePayload {
  name?: string;
  nickname?: string;
  email?: string;
  avatar?: string;
  /** Opcional: si viene vacío, el componente NO debe enviarlo. */
  password?: string;
}

@Service()
export class AdminUsersApi {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/users`;

  list(): Observable<AdminUser[]> {
    return this.http.get<ApiEnvelope<AdminUser[]>>(this.base).pipe(unwrap());
  }

  getById(id: string): Observable<AdminUser> {
    return this.http.get<ApiEnvelope<AdminUser>>(`${this.base}/${id}`).pipe(unwrap());
  }

  create(payload: CreateUserPayload): Observable<AdminUser> {
    return this.http.post<ApiEnvelope<AdminUser>>(this.base, payload).pipe(unwrap());
  }

  updateProfile(id: string, payload: UpdateProfilePayload): Observable<AdminUser> {
    return this.http.patch<ApiEnvelope<AdminUser>>(`${this.base}/${id}`, payload).pipe(unwrap());
  }

  updateRole(id: string, role: AdminRole): Observable<AdminUser> {
    return this.http
      .patch<ApiEnvelope<AdminUser>>(`${this.base}/${id}/role`, { role })
      .pipe(unwrap());
  }

  updateStatus(id: string, status: boolean): Observable<AdminUser> {
    return this.http
      .patch<ApiEnvelope<AdminUser>>(`${this.base}/${id}/status`, { status })
      .pipe(unwrap());
  }

  remove(id: string): Observable<AdminUser> {
    return this.http.delete<ApiEnvelope<AdminUser>>(`${this.base}/${id}`).pipe(unwrap());
  }
}
