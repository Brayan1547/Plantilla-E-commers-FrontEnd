import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { IconComponent } from '../icon/icon';

/**
 * Paginación CLIENT-SIDE.
 *
 * Nota de arquitectura: los endpoints de listado del backend (`GET /users`,
 * `/product`, `/category`) devuelven el arreglo COMPLETO, sin `page`/`limit`.
 * Por eso la paginación es en cliente. Para datasets grandes se requiere
 * paginación server-side -> ver PENDING BACKEND en el informe.
 */
@Component({
  selector: 'adm-pagination',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    @if (totalItems() > 0) {
      <nav class="adm-pagination" aria-label="Paginación">
        <span>
          {{ rangeStart() }}–{{ rangeEnd() }} de {{ totalItems() }}
        </span>
        <span class="adm-pagination__pages">
          <button type="button" class="adm-pagination__btn"
            [disabled]="page() <= 1"
            (click)="go(page() - 1)" aria-label="Página anterior">
            <adm-icon name="chevron-left" [size]="14" />
          </button>
          @for (p of pages(); track p) {
            @if (p === -1) {
              <span class="adm-pagination__btn" style="border:0;background:none;cursor:default">…</span>
            } @else {
              <button type="button" class="adm-pagination__btn"
                [class.is-active]="p === page()"
                [attr.aria-current]="p === page() ? 'page' : null"
                (click)="go(p)">{{ p }}</button>
            }
          }
          <button type="button" class="adm-pagination__btn"
            [disabled]="page() >= totalPages()"
            (click)="go(page() + 1)" aria-label="Página siguiente">
            <adm-icon name="chevron-right" [size]="14" />
          </button>
        </span>
      </nav>
    }
  `,
})
export class PaginationComponent {
  page = input.required<number>();
  pageSize = input<number>(10);
  totalItems = input.required<number>();
  pageChange = output<number>();

  protected totalPages = computed(() =>
    Math.max(1, Math.ceil(this.totalItems() / this.pageSize())),
  );
  protected rangeStart = computed(() =>
    this.totalItems() === 0 ? 0 : (this.page() - 1) * this.pageSize() + 1,
  );
  protected rangeEnd = computed(() =>
    Math.min(this.page() * this.pageSize(), this.totalItems()),
  );

  /** Lista compacta de páginas con elipsis (-1 = separador). */
  protected pages = computed<number[]>(() => {
    const total = this.totalPages();
    const current = this.page();
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const out: number[] = [1];
    const from = Math.max(2, current - 1);
    const to = Math.min(total - 1, current + 1);
    if (from > 2) out.push(-1);
    for (let i = from; i <= to; i++) out.push(i);
    if (to < total - 1) out.push(-1);
    out.push(total);
    return out;
  });

  protected go(p: number): void {
    const clamped = Math.min(Math.max(1, p), this.totalPages());
    if (clamped !== this.page()) this.pageChange.emit(clamped);
  }
}
