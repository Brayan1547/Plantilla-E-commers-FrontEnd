import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import type { InventorySummary } from '../dashboard.models';

/**
 * UI-5.3 — Resumen de inventario derivado de `product.stock` (el backend no
 * tiene módulo de inventario propio: sin variantes-por-SKU, movimientos ni
 * almacenes). "Stock bajo" usa el umbral que envía el backend
 * (`inventory.lowStockThreshold`), no un número hardcodeado aquí.
 */
@Component({
  selector: 'adm-dash-inventory-summary',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <div class="adm-card">
      <div class="adm-card__header">
        <h2>Inventario</h2>
        <a class="adm-link" routerLink="/admin/inventory">Ver inventario</a>
      </div>
      <div class="adm-card__body">
        <div class="adm-kpi-grid adm-kpi-grid--compact">
          <div class="adm-kpi">
            <span class="adm-kpi__label">Productos</span>
            <span class="adm-kpi__value">{{ inventory().totalProducts }}</span>
            <span class="adm-kpi__compare">{{ inventory().publishedProducts }} publicados</span>
          </div>
          <div class="adm-kpi">
            <span class="adm-kpi__label adm-kpi__ind adm-kpi__ind--warn">Stock bajo</span>
            <span class="adm-kpi__value">{{ inventory().lowStock }}</span>
            <span class="adm-kpi__compare">≤ {{ inventory().lowStockThreshold }} unidades</span>
          </div>
          <div class="adm-kpi">
            <span class="adm-kpi__label adm-kpi__ind adm-kpi__ind--danger">Agotados</span>
            <span class="adm-kpi__value">{{ inventory().outOfStock }}</span>
            <span class="adm-kpi__compare">sin stock</span>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class InventorySummaryComponent {
  inventory = input.required<InventorySummary>();
}
