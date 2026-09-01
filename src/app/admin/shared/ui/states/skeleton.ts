import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Placeholder de carga. `variant`:
 *  - 'text'  -> líneas de texto
 *  - 'block' -> bloque rectangular (altura configurable)
 *  - 'table' -> filas de tabla (usar dentro de .adm-table-wrap)
 *  - 'kpi'   -> rejilla de tarjetas KPI
 */
@Component({
  selector: 'adm-skeleton',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (variant()) {
      @case ('table') {
        <div class="adm-table-wrap" aria-hidden="true">
          <table class="adm-table">
            <tbody>
              @for (row of rows(); track $index) {
                <tr>
                  @for (col of cols(); track $index) {
                    <td><span class="adm-skel" style="display:block;height:14px"></span></td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
      @case ('kpi') {
        <div class="adm-kpi-grid" aria-hidden="true">
          @for (k of rows(); track $index) {
            <div class="adm-kpi">
              <span class="adm-skel" style="display:block;height:10px;width:50%"></span>
              <span class="adm-skel" style="display:block;height:24px;width:70%"></span>
              <span class="adm-skel" style="display:block;height:10px;width:40%"></span>
            </div>
          }
        </div>
      }
      @case ('block') {
        <span class="adm-skel" aria-hidden="true"
          [style.display]="'block'" [style.height.px]="height()"></span>
      }
      @default {
        <div aria-hidden="true" style="display:flex;flex-direction:column;gap:10px">
          @for (line of rows(); track $index) {
            <span class="adm-skel" style="display:block;height:12px"
              [style.width.%]="$last ? 60 : 100"></span>
          }
        </div>
      }
    }
    <span class="adm-sr-only" role="status">Cargando…</span>
  `,
})
export class SkeletonComponent {
  variant = input<'text' | 'block' | 'table' | 'kpi'>('text');
  count = input<number>(3);
  columns = input<number>(5);
  height = input<number>(120);

  protected rows = computed(() => Array.from({ length: Math.max(1, this.count()) }));
  protected cols = computed(() => Array.from({ length: Math.max(1, this.columns()) }));
}
