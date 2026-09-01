import { Observable, map } from 'rxjs';

import type { ApiEnvelope } from '../models/admin.models';

/**
 * El backend DUSCK responde `{ msg, data }`. En varios controladores un error
 * de negocio (email duplicado, validación de Mongoose, etc.) se devuelve con
 * status 200 y SIN `data` (p. ej. `createUser`/`createCategory` en su `catch`).
 *
 * `unwrap` normaliza eso: si en una respuesta 2xx no llega `data`, se lanza un
 * error con el `msg` del backend para que el flujo de error del componente lo
 * trate igual que un 4xx/5xx.
 */
export function unwrap<T>() {
  return (source: Observable<ApiEnvelope<T>>): Observable<T> =>
    source.pipe(
      map((res) => {
        if (res == null || res.data === undefined || res.data === null) {
          throw new ApiBusinessError(res?.msg ?? 'La operación no devolvió datos.');
        }
        return res.data;
      }),
    );
}

/** Error de negocio devuelto con status 2xx (contrato inconsistente del backend). */
export class ApiBusinessError extends Error {
  readonly status = 200;
  constructor(message: string) {
    super(message);
    this.name = 'ApiBusinessError';
  }
}
