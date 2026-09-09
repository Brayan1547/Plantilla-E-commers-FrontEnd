import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { formatCurrencyCOP } from '../../../shared/util/format.util';
import { bucketShortLabel, type SalesBucket } from '../dashboard.models';

interface Bar {
  key: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  tip: string;
}

const VIEW_W = 1000;
const VIEW_H = 260;
const PAD_BOTTOM = 24; // espacio para el eje de etiquetas
const GAP_RATIO = 0.28;
const MAX_TICKS = 8;

/**
 * UI-5.3 — Evolución de ventas por período. SVG inline propio (mismo enfoque que
 * `adm-icon`): sin librería de gráficas, escala por `viewBox`, hereda los tokens
 * `--adm-*`. Tooltip nativo por `<title>`. Un día sin ventas es una barra de
 * altura 0, no un hueco.
 */
@Component({
  selector: 'adm-dash-sales-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="adm-card">
      <div class="adm-card__header">
        <h2>Evolución de ventas</h2>
        <span class="adm-note">{{ granularityLabel() }}</span>
      </div>
      <div class="adm-card__body">
        @if (hasData()) {
          <figure style="margin:0">
            <svg
              [attr.viewBox]="'0 0 ' + viewW + ' ' + viewH"
              preserveAspectRatio="none"
              role="img"
              [attr.aria-label]="'Ventas por ' + (granularity() === 'month' ? 'mes' : 'día') + ' del período'"
              style="display:block;width:100%;height:220px">
              <!-- línea base -->
              <line
                [attr.x1]="0" [attr.x2]="viewW"
                [attr.y1]="baselineY" [attr.y2]="baselineY"
                stroke="var(--adm-line-strong)" stroke-width="1" />
              @for (b of bars(); track b.key) {
                <rect
                  [attr.x]="b.x" [attr.y]="b.y"
                  [attr.width]="b.w" [attr.height]="b.h"
                  rx="1.5"
                  fill="var(--adm-accent)">
                  <title>{{ b.tip }}</title>
                </rect>
              }
            </svg>
            <figcaption
              style="display:flex;justify-content:space-between;margin-top:6px;font-size:var(--adm-fs-2xs);color:var(--adm-ink-faint)">
              @for (t of ticks(); track t) {
                <span>{{ t }}</span>
              }
            </figcaption>
          </figure>

          <div class="adm-inline" style="margin-top:14px;gap:20px">
            <span class="adm-note">Máximo: <strong>{{ money(maxValue()) }}</strong></span>
            <span class="adm-note">Total del período: <strong>{{ money(totalValue()) }}</strong></span>
          </div>
        } @else {
          <p class="adm-note">Sin ventas registradas en el período seleccionado.</p>
        }
      </div>
    </div>
  `,
})
export class SalesChartComponent {
  series = input.required<SalesBucket[]>();
  granularity = input<'day' | 'month'>('day');

  protected readonly viewW = VIEW_W;
  protected readonly viewH = VIEW_H;
  protected readonly baselineY = VIEW_H - PAD_BOTTOM;
  protected readonly money = formatCurrencyCOP;

  protected maxValue = computed(() =>
    this.series().reduce((m, b) => Math.max(m, b.salesTotal), 0),
  );
  protected totalValue = computed(() =>
    this.series().reduce((s, b) => s + b.salesTotal, 0),
  );
  protected hasData = computed(() => this.maxValue() > 0);

  protected granularityLabel = computed(() =>
    this.granularity() === 'month' ? 'Agrupado por mes' : 'Agrupado por día',
  );

  protected bars = computed<Bar[]>(() => {
    const data = this.series();
    const n = data.length;
    if (!n) return [];
    const max = this.maxValue() || 1;
    const plotH = this.baselineY;
    const slot = VIEW_W / n;
    const w = slot * (1 - GAP_RATIO);
    const offset = (slot - w) / 2;

    return data.map((b, i) => {
      const h = max > 0 ? (b.salesTotal / max) * (plotH - 4) : 0;
      return {
        key: b.bucket,
        x: i * slot + offset,
        y: this.baselineY - h,
        w,
        h,
        label: bucketShortLabel(b.bucket),
        tip: `${bucketShortLabel(b.bucket)} — ${formatCurrencyCOP(b.salesTotal)} · ${b.ordersCount} pedido(s)`,
      };
    });
  });

  /** Etiquetas del eje X: primera, última y algunas intermedias. */
  protected ticks = computed<string[]>(() => {
    const data = this.series();
    const n = data.length;
    if (!n) return [];
    if (n <= MAX_TICKS) return data.map((b) => bucketShortLabel(b.bucket));
    const step = Math.ceil(n / MAX_TICKS);
    const out: string[] = [];
    for (let i = 0; i < n; i += step) out.push(bucketShortLabel(data[i].bucket));
    const last = bucketShortLabel(data[n - 1].bucket);
    if (out[out.length - 1] !== last) out.push(last);
    return out;
  });
}
