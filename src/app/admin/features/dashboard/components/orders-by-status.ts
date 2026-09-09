import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { StatusBadgeComponent } from '../../../shared/ui/status-badge/status-badge';
import { statusLabel, statusTone, type OrdersBreakdown } from '../dashboard.models';

interface Row {
  status: string;
  count: number;
  pct: number;
}

/**
 * UI-5.3 — Pedidos del período agrupados por estado. Barra proporcional +
 * `adm-status-badge` (mismo lenguaje visual que el módulo de Pedidos).
 */
@Component({
  selector: 'adm-dash-orders-summary',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, StatusBadgeComponent],
  template: `
    <div class="adm-card">
      <div class="adm-card__header">
        <h2>Pedidos por estado</h2>
        <a class="adm-link" routerLink="/admin/orders">Ver pedidos</a>
      </div>
      <div class="adm-card__body">
        <p class="adm-kpi__value" style="margin-bottom:14px">{{ orders().total }}</p>
        <p class="adm-note" style="margin:-12px 0 16px">pedidos finalizados en el período</p>

        @if (rows().length) {
          <div class="adm-stack" style="gap:12px">
            @for (r of rows(); track r.status) {
              <div>
                <div class="adm-inline" style="justify-content:space-between;margin-bottom:5px">
                  <adm-status-badge [label]="label(r.status)" [tone]="tone(r.status)" />
                  <span class="adm-mono">{{ r.count }}</span>
                </div>
                <div style="height:6px;border-radius:999px;background:var(--adm-surface-2);overflow:hidden">
                  <div
                    [style.width.%]="r.pct"
                    style="height:100%;background:var(--adm-accent)"></div>
                </div>
              </div>
            }
          </div>
        } @else {
          <p class="adm-note">Aún no hay pedidos en el período seleccionado.</p>
        }
      </div>
    </div>
  `,
})
export class OrdersByStatusComponent {
  orders = input.required<OrdersBreakdown>();

  protected readonly label = statusLabel;
  protected readonly tone = statusTone;

  protected rows = computed<Row[]>(() => {
    const by = this.orders().byStatus;
    const entries = Object.entries(by).filter(([, n]) => n > 0);
    const max = entries.reduce((m, [, n]) => Math.max(m, n), 0) || 1;
    return entries
      .sort((a, b) => b[1] - a[1])
      .map(([status, count]) => ({ status, count, pct: Math.round((count / max) * 100) }));
  });
}
