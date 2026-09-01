import { HttpClient } from '@angular/common/http';
import { Service, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';

import { environment } from '../../../../environments/environment';
import type { ApiEnvelope, RoleOption } from '../models/admin.models';
import { ROLE_LABELS, type AdminRole } from '../models/permission.model';
import { unwrap } from './api.util';

/**
 * `GET /roles` (admin-only) -> { msg, data: [{ id, name }] }.
 * Es SOLO LECTURA: el backend deriva la lista de `global.config.js`
 * (`ALLOWED_ROLES` + `ROLES_LABELS`). No hay crear/editar/eliminar rol ni
 * permisos granulares -> el módulo de Roles no ofrece esa UI.
 *
 * Actúa además como caché compartida: los selects de rol (Usuarios) consumen
 * `options()` en lugar de una lista hardcodeada. Si la petición falla, se
 * degrada a `ROLE_LABELS` (mismos 4 roles reales del backend) para que los
 * formularios sigan siendo utilizables.
 */
@Service()
export class AdminRolesApi {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/roles`;

  private _roles = signal<RoleOption[] | null>(null);
  private _usedFallback = signal(false);

  /** true si la lista actual proviene del fallback local, no de `GET /roles`. */
  readonly usedFallback = this._usedFallback.asReadonly();

  private readonly fallback: RoleOption[] = (Object.keys(ROLE_LABELS) as AdminRole[]).map((id) => ({
    id,
    name: ROLE_LABELS[id],
  }));

  /** Opciones de rol para selects. Nunca vacío. */
  readonly options = computed<RoleOption[]>(() => this._roles() ?? this.fallback);

  /** Petición explícita (para la página de Roles, con estados de carga/error). */
  list(): Observable<RoleOption[]> {
    return this.http.get<ApiEnvelope<RoleOption[]>>(this.base).pipe(
      unwrap(),
      tap((roles) => {
        this._roles.set(roles);
        this._usedFallback.set(false);
      }),
    );
  }

  /** Carga perezosa e idempotente para los formularios. */
  ensureLoaded(): void {
    if (this._roles() !== null) return;
    this.list().subscribe({
      error: () => {
        this._roles.set(this.fallback);
        this._usedFallback.set(true);
      },
    });
  }
}
