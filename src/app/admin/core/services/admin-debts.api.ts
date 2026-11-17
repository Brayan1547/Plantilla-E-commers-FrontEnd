import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import type { ApiEnvelope } from '../models/admin.models';
import type { Debt, DebtPayload, DebtSummary, PaymentPayload } from '../models/debt.model';
import { unwrap } from './api.util';

/**
 * Contrato (`debt.routes.js`) — TODAS las rutas exigen rol administrador:
 *   GET    /debts                          -> Debt[]
 *   GET    /debts/summary                  -> DebtSummary
 *   GET    /debts/:id                      -> Debt
 *   POST   /debts                          -> Debt (201)
 *   PATCH  /debts/:id                      -> Debt   (no cambia `direction`)
 *   DELETE /debts/:id                      -> Debt
 *   POST   /debts/:id/payments             -> Debt con el abono incluido (201)
 *   DELETE /debts/:id/payments/:paymentId  -> Debt sin ese abono
 */
@Service()
export class AdminDebtsApi {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/debts`;

  list(): Observable<Debt[]> {
    return this.http.get<ApiEnvelope<Debt[]>>(this.base).pipe(unwrap());
  }

  summary(): Observable<DebtSummary> {
    return this.http.get<ApiEnvelope<DebtSummary>>(`${this.base}/summary`).pipe(unwrap());
  }

  getById(id: string): Observable<Debt> {
    return this.http.get<ApiEnvelope<Debt>>(`${this.base}/${id}`).pipe(unwrap());
  }

  create(payload: DebtPayload): Observable<Debt> {
    return this.http.post<ApiEnvelope<Debt>>(this.base, payload).pipe(unwrap());
  }

  update(id: string, payload: Partial<DebtPayload>): Observable<Debt> {
    return this.http.patch<ApiEnvelope<Debt>>(`${this.base}/${id}`, payload).pipe(unwrap());
  }

  remove(id: string): Observable<Debt> {
    return this.http.delete<ApiEnvelope<Debt>>(`${this.base}/${id}`).pipe(unwrap());
  }

  addPayment(id: string, payload: PaymentPayload): Observable<Debt> {
    return this.http.post<ApiEnvelope<Debt>>(`${this.base}/${id}/payments`, payload).pipe(unwrap());
  }

  removePayment(id: string, paymentId: string): Observable<Debt> {
    return this.http
      .delete<ApiEnvelope<Debt>>(`${this.base}/${id}/payments/${paymentId}`)
      .pipe(unwrap());
  }
}