import { HttpErrorResponse } from '@angular/common/http';

import { ApiBusinessError } from './api.util';

export interface NormalizedError {
  status: number;
  /** Mensaje apto para mostrar al operador (nunca stack ni detalle interno). */
  message: string;
  /** true si reintentar la misma acción tiene sentido. */
  retryable: boolean;
}

const GENERIC: Record<number, string> = {
  0: 'No se pudo contactar con el servidor. Revisa tu conexión.',
  400: 'La solicitud no es válida. Revisa los datos e inténtalo de nuevo.',
  401: 'Tu sesión expiró. Vuelve a iniciar sesión.',
  403: 'No tienes permisos para realizar esta acción.',
  404: 'El recurso solicitado no existe o fue eliminado.',
  409: 'El recurso ya existe o está en conflicto con otro.',
  422: 'Algunos campos no superaron la validación del servidor.',
  429: 'Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.',
  500: 'Ocurrió un error en el servidor. Inténtalo más tarde.',
  503: 'El servicio no está disponible temporalmente.',
};

/**
 * Convierte cualquier error HTTP en un `NormalizedError` estable. Prioriza el
 * `msg` que envía el backend DUSCK (`{ msg }`), pero cae a un texto genérico
 * por status para no filtrar detalles técnicos.
 */
export function normalizeError(err: unknown): NormalizedError {
  if (err instanceof ApiBusinessError) {
    return { status: 200, message: err.message, retryable: false };
  }
  if (err instanceof HttpErrorResponse) {
    const status = err.status ?? 0;
    const backendMsg =
      typeof err.error?.msg === 'string' && err.error.msg.trim().length
        ? err.error.msg.trim()
        : null;
    return {
      status,
      message: backendMsg ?? GENERIC[status] ?? 'Ocurrió un error inesperado.',
      retryable: status === 0 || status === 429 || status >= 500,
    };
  }
  return {
    status: 0,
    message: 'Ocurrió un error inesperado.',
    retryable: true,
  };
}
