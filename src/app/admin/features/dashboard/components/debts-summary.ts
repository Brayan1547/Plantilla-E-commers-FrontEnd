import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';

import { AdminDebtsApi } from '../../../core/services/admin-debts.api';
import { PermissionsService } from '../../../core/services/permissions';
import type { DebtSummary } from '../../../core/models/debt.model';
import { KpiCardComponent } from '../../../shared/ui/kpi-card/kpi-card';
import { formatCurrencyCOP } from '../../../shared/util/format.util';

/**
 * Resumen de deudas para el Inicio del panel (`GET /api/debts/summary`).
 * Solo se muestra con el permiso `debts.read` (administrador). Si la petición
 * falla no rompe el dashboard: simplemente muestra un aviso.
 */
@Component({
  selector: 'adm-dash-debts',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, KpiCardComponent],
  template: `
    @if (canRead) {
      <div class="adm-card" style="margin-top:20px">
        <div class="adm-card__header adm-inline" style="justify-content:space-between">
          <h2>Deudas</h2>
          <a class="adm-btn adm-btn--ghost adm-btn--sm" routerLink="/admin/debts">Ver deudas →</a>
        </div>
        <div class="adm-card__body">
          @if (summary(); as s) {
            <div class="adm-kpi-grid adm-kpi-grid--compact">
              <adm-kpi-card label="Me deben" [value]="money(s.meDeben.total)"
                [compare]="s.meDeben.count + ' deuda(s) con saldo'" />
              <adm-kpi-card label="Yo debo" [value]="money(s.yoDebo.total)"
                [compare]="s.yoDebo.count + ' deuda(s) con saldo'" />
              <adm-kpi-card label="Vencidas"
                [value]="s.meDeben.overdueCount + s.yoDebo.overdueCount"
                [compare]="s.meDeben.overdueCount + ' por cobrar · ' + s.yoDebo.overdueCount + ' por pagar'" />
            </div>
          } @else if (failed()) {
            <p class="adm-note">No se pudo cargar el resumen de deudas.</p>
          } @else {
            <p class="adm-note">Cargando…</p>
          }
        </div>
      </div>
    }
  `,
})
export class DebtsSummaryComponent {
  private api = inject(AdminDebtsApi);
  private perms = inject(PermissionsService);

  protected readonly canRead = this.perms.can('debts.read');
  protected readonly money = formatCurrencyCOP;
  protected summary = signal<DebtSummary | null>(null);
  protected failed = signal(false);

  constructor() {
    if (!this.canRead) return;
    this.api
      .summary()
      .pipe(catchError(() => (this.failed.set(true), of(null))))
      .subscribe((s) => this.summary.set(s));
  }
}