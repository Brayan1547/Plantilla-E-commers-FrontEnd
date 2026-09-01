import { ChangeDetectionStrategy, Component, computed, contentChild, input, output, TemplateRef } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

import { IconComponent } from '../icon/icon';
import { SkeletonComponent } from '../states/skeleton';
import { EmptyStateComponent } from '../states/empty-state';
import { ErrorStateComponent } from '../states/error-state';
import type { LoadState } from '../../../core/models/admin.models';

export interface TableColumn {
  /** Clave para ordenamiento; si se omite, la columna no es ordenable. */
  key?: string;
  label: string;
  align?: 'left' | 'right' | 'center';
  width?: string;
}

export interface SortState {
  key: string;
  dir: 'asc' | 'desc';
}

/**
 * Tabla administrativa reutilizable.
 *
 * - `thead` derivado de `columns`.
 * - `tbody` renderizado por el consumidor mediante `<ng-template admRow let-row let-i="index">`
 *   (control total del contenido de cada celda).
 * - Maneja internamente loading / empty / error.
 * - Ordenamiento: emite `sortChange`; el ordenamiento efectivo lo aplica el
 *   consumidor (client-side; el backend no soporta `sort`).
 */
@Component({
  selector: 'adm-data-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, IconComponent, SkeletonComponent, EmptyStateComponent, ErrorStateComponent],
  template: `
    @switch (state()) {
      @case ('loading') {
        <adm-skeleton variant="table" [count]="skeletonRows()" [columns]="columns().length" />
      }
      @case ('error') {
        <div class="adm-card"><adm-error-state [message]="errorMessage()" (retry)="retry.emit()" /></div>
      }
      @case ('empty') {
        <div class="adm-card">
          <adm-empty-state [icon]="'inbox'" [title]="emptyTitle()" [message]="emptyMessage()">
            <ng-content select="[empty-action]" ngProjectAs="[action]" />
          </adm-empty-state>
        </div>
      }
      @default {
        <div class="adm-table-wrap">
          <table class="adm-table">
            <thead>
              <tr>
                @for (col of columns(); track col.label) {
                  <th
                    [style.width]="col.width || null"
                    [style.text-align]="col.align || 'left'"
                    [class.is-sortable]="!!col.key"
                    (click)="col.key && toggleSort(col.key)">
                    {{ col.label }}
                    @if (col.key && sort()?.key === col.key) {
                      <adm-icon [name]="sort()!.dir === 'asc' ? 'chevron-up' : 'chevron-down'" [size]="12" />
                    }
                  </th>
                }
              </tr>
            </thead>
            <tbody>
              @for (row of rows(); track trackRow()(row, $index); let i = $index) {
                <tr>
                  <ng-container
                    [ngTemplateOutlet]="rowTpl() ?? null"
                    [ngTemplateOutletContext]="{ $implicit: row, index: i }" />
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    }
  `,
})
export class DataTableComponent<T = unknown> {
  columns = input.required<TableColumn[]>();
  rows = input.required<readonly T[]>();
  state = input<LoadState>('ready');
  errorMessage = input<string>('No se pudo cargar la información.');
  emptyTitle = input<string>('Sin resultados');
  emptyMessage = input<string>('No hay elementos que coincidan con los filtros actuales.');
  sort = input<SortState | null>(null);
  skeletonRows = input<number>(8);
  trackRow = input<(row: T, index: number) => unknown>((_, index) => index);

  sortChange = output<SortState>();
  retry = output<void>();

  private rowTplRef = contentChild<TemplateRef<unknown>>('admRow');
  protected rowTpl = computed(() => this.rowTplRef() ?? null);

  protected toggleSort(key: string): void {
    const current = this.sort();
    const dir: 'asc' | 'desc' =
      current?.key === key && current.dir === 'asc' ? 'desc' : 'asc';
    this.sortChange.emit({ key, dir });
  }
}
