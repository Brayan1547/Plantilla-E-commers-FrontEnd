import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { EmptyStateComponent } from '../../../shared/ui/states/empty-state';
import { formatCurrencyCOP } from '../../../shared/util/format.util';
import type { TopProduct } from '../dashboard.models';

interface Row extends TopProduct {
  pct: number;
}

/**
 * UI-5.3 — Productos más vendidos del período (por unidades). Se calcula sobre
 * el SNAPSHOT de `items[]` de las órdenes (nombre/slug congelados), así que un
 * producto ya borrado sigue apareciendo con su nombre histórico. Excluye
 * pedidos cancelados.
 */
@Component({
  selector: 'adm-dash-top-products',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EmptyStateComponent],
  template: `
    <div class="adm-card">
      <div class="adm-card__header"><h2>Productos más vendidos</h2></div>
      <div class="adm-card__body">
        @if (rows().length) {
          <div class="adm-stack" style="gap:14px">
            @for (r of rows(); track r.productId ?? r.productName) {
              <div>
                <div class="adm-inline" style="justify-content:space-between;margin-bottom:5px">
                  <span><strong>{{ r.productName || 'Producto sin nombre' }}</strong></span>
                  <span class="adm-mono">{{ r.unitsSold }} u.</span>
                </div>
                <div style="height:6px;border-radius:999px;background:var(--adm-surface-2);overflow:hidden">
                  <div [style.width.%]="r.pct" style="height:100%;background:var(--adm-accent)"></div>
                </div>
                <p class="adm-note" style="margin-top:4px">{{ money(r.salesTotal) }}</p>
              </div>
            }
          </div>
        } @else {
          <adm-empty-state
            icon="box"
            title="Sin ventas de productos"
            message="No hay unidades vendidas en el período seleccionado." />
        }
      </div>
    </div>
  `,
})
export class TopProductsComponent {
  products = input.required<TopProduct[]>();
  protected readonly money = formatCurrencyCOP;

  protected rows = computed<Row[]>(() => {
    const list = this.products();
    const max = list.reduce((m, p) => Math.max(m, p.unitsSold), 0) || 1;
    return list.map((p) => ({ ...p, pct: Math.round((p.unitsSold / max) * 100) }));
  });
}
