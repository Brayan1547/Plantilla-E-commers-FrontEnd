import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { map, Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import type { CreateOrderPayload, OrderApiEnvelope, OrderConfirmation } from '../models/order.model';

/**
 * UI-4B — Cliente HTTP de `POST /api/orders` (checkout COD, invitado o
 * autenticado). Sigue la convención de los demás servicios HTTP del proyecto
 * (`http-cart` / `http-product`): `@Service()`, `inject(HttpClient)`,
 * `BASE_URL` desde `environment.apiUrl`.
 *
 * Responsabilidad ÚNICA: enviar el payload ya construido + el header
 * `Idempotency-Key`. NO construye el payload, NO valida negocio, NO decide el
 * `Idempotency-Key` (lo genera y conserva el componente de checkout, ver
 * UI-4B §15). El `x-token` lo añade `authInterceptor` cuando hay sesión; un
 * invitado no envía token y el backend crea la orden con `userId: null`.
 */
@Service()
export class HttpOrder {
  private http = inject(HttpClient);
  private readonly BASE_URL = `${environment.apiUrl}/orders`;

  /**
   * `POST /api/orders`.
   * @param payload  cuerpo EXACTO del contrato (items/customer/shippingAddress/notes).
   * @param idempotencyKey  UUID v1–5 generado por el componente; DEBE reutilizarse
   *                        en los reintentos del MISMO intento (no regenerar por
   *                        doble click / botón "Reintentar").
   * @returns la orden creada (`data` de la respuesta 201).
   */
  createOrder(payload: CreateOrderPayload, idempotencyKey: string): Observable<OrderConfirmation> {
    const headers = new HttpHeaders({
      'content-type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    });
    return this.http
      .post<OrderApiEnvelope>(this.BASE_URL, payload, { headers })
      .pipe(map((res) => res.data));
  }
}
