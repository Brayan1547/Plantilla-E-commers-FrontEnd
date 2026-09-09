import { HttpClient, HttpParams } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import type { ApiEnvelope } from '../../core/models/admin.models';
import { unwrap } from '../../core/services/api.util';
import type { DashboardData, DashboardQuery } from './dashboard.models';

/**
 * UI-5.3 — Cliente HTTP del panel de indicadores.
 *
 * Contrato REAL (`Backend-Dusck/src/routes/dashboard.routes.js`), tras
 * `autenticationUser` + `authorizationUser(['administrador','shop_manager'])`:
 *
 *   GET /api/dashboard?from&to&granularity  -> { msg, data: DashboardData }
 *
 * El `x-token` lo añade `authInterceptor`. UNA sola petición entrega TODAS las
 * métricas (resumen, serie de ventas, pedidos por estado, top de productos,
 * inventario y alertas) — el componente NUNCA hace fan-out a otros endpoints
 * para construir el dashboard.
 */
@Service()
export class AdminDashboardApi {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/dashboard`;

  get(query: DashboardQuery = {}): Observable<DashboardData> {
    let params = new HttpParams();
    if (query.from) params = params.set('from', query.from);
    if (query.to) params = params.set('to', query.to);
    if (query.granularity) params = params.set('granularity', query.granularity);
    return this.http
      .get<ApiEnvelope<DashboardData>>(this.base, { params })
      .pipe(unwrap());
  }
}
