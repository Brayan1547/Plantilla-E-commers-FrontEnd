import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { IconComponent } from '../../../shared/ui/icon/icon';
import type { OperationalAlert } from '../dashboard.models';

/**
 * UI-5.3 — Alertas operativas derivadas de datos REALES (pedidos sin confirmar
 * hace >48 h, entregados sin pago, productos publicados y agotados). El backend
 * solo devuelve las alertas ACTIVAS (count > 0); si no hay ninguna, se muestra
 * un estado "todo en orden", nunca una alerta inventada.
 */
@Component({
  selector: 'adm-dash-operational-alerts',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="adm-card">
      <div class="adm-card__header"><h2>Alertas operativas</h2></div>
      <div class="adm-card__body">
        @if (alerts().length) {
          <div class="adm-stack" style="gap:10px">
            @for (a of alerts(); track a.code) {
              <div
                class="adm-callout"
                [class.adm-callout--warn]="a.severity === 'warn'"
                [class.adm-callout--danger]="a.severity === 'danger'">
                <span class="adm-callout__icon">
                  <adm-icon name="alert" [size]="18" />
                </span>
                <p>{{ a.message }}</p>
              </div>
            }
          </div>
        } @else {
          <div class="adm-inline adm-note">
            <adm-icon name="check" [size]="16" />
            <span>No hay alertas operativas pendientes.</span>
          </div>
        }
      </div>
    </div>
  `,
})
export class OperationalAlertsComponent {
  alerts = input.required<OperationalAlert[]>();
}
