import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { formatCurrencyCOP } from '../../../shared/util/format.util';
import type { DashboardSummary } from '../dashboard.models';

/**
 * UI-5.3 — Fila de indicadores de resumen. Reutiliza `.adm-kpi` del design
 * system. NUNCA inventa cifras: 0 pedidos / $0 son valores legítimos.
 */
@Component({
  selector: 'adm-dash-summary-cards',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="adm-kpi-grid">
      <div class="adm-kpi">
        <span class="adm-kpi__label">Ventas de hoy</span>
        <span class="adm-kpi__value">{{ money(summary().today.salesTotal) }}</span>
        <span class="adm-kpi__compare">{{ summary().today.ordersCount }} pedido(s) hoy</span>
      </div>

      <div class="adm-kpi">
        <span class="adm-kpi__label">Ventas del período</span>
        <span class="adm-kpi__value">{{ money(summary().period.salesTotal) }}</span>
        <span class="adm-kpi__compare">{{ summary().period.ordersCount }} pedido(s) · brutas, sin canceladas</span>
      </div>

      <div class="adm-kpi">
        <span class="adm-kpi__label">Ticket promedio</span>
        <span class="adm-kpi__value">{{ money(summary().period.averageTicket) }}</span>
        <span class="adm-kpi__compare">Período seleccionado</span>
      </div>

      <div class="adm-kpi">
        <span class="adm-kpi__label">Ingresos cobrados</span>
        <span class="adm-kpi__value">{{ money(summary().collectedRevenue.period) }}</span>
        <span class="adm-kpi__compare">Pagos confirmados (COD)</span>
      </div>
    </div>
  `,
})
export class SummaryCardsComponent {
  summary = input.required<DashboardSummary>();
  protected readonly money = formatCurrencyCOP;
}
