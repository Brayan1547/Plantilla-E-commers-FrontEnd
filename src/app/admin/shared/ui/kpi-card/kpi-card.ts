import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { IconComponent } from '../icon/icon';

/**
 * Tarjeta KPI. Si `pending` es true (no existe endpoint que alimente el dato),
 * muestra explícitamente "Datos no disponibles" — NUNCA un número inventado.
 */
@Component({
  selector: 'adm-kpi-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="adm-kpi">
      <span class="adm-kpi__label">{{ label() }}</span>

      @if (pending()) {
        <span class="adm-kpi__value adm-kpi__value--muted">Datos no disponibles</span>
        <span class="adm-kpi__compare">Requiere backend</span>
      } @else {
        <span class="adm-kpi__value">{{ value() }}</span>
        @if (hasDelta()) {
          <span class="adm-kpi__foot">
            <span class="adm-kpi__delta" [class]="deltaClass()">
              @if (direction() === 'up') { <adm-icon name="arrow-up" [size]="12" /> }
              @if (direction() === 'down') { <adm-icon name="arrow-down" [size]="12" /> }
              {{ deltaText() }}
            </span>
            @if (compare()) { <span class="adm-kpi__compare">{{ compare() }}</span> }
          </span>
        } @else if (compare()) {
          <span class="adm-kpi__compare">{{ compare() }}</span>
        }
      }
    </div>
  `,
})
export class KpiCardComponent {
  label = input.required<string>();
  value = input<string | number>('');
  /** Variación porcentual respecto al período anterior (ej. 12.4 o -3). */
  delta = input<number | null>(null);
  /** Texto del período comparado (ej. "vs. mes anterior"). */
  compare = input<string>('');
  pending = input<boolean>(false);

  protected hasDelta = computed(() => this.delta() !== null && !Number.isNaN(this.delta()!));
  protected direction = computed<'up' | 'down' | 'flat'>(() => {
    const d = this.delta() ?? 0;
    if (d > 0) return 'up';
    if (d < 0) return 'down';
    return 'flat';
  });
  protected deltaClass = computed(() => `adm-kpi__delta--${this.direction()}`);
  protected deltaText = computed(() => {
    const d = this.delta() ?? 0;
    const sign = d > 0 ? '+' : '';
    return `${sign}${d}%`;
  });
}
