import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type BadgeTone = 'ok' | 'warn' | 'danger' | 'info' | 'neutral';

@Component({
  selector: 'adm-status-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="adm-badge" [class]="'adm-badge--' + tone()">
      @if (dot()) { <span class="adm-badge__dot"></span> }
      {{ label() }}
    </span>
  `,
})
export class StatusBadgeComponent {
  label = input.required<string>();
  tone = input<BadgeTone>('neutral');
  dot = input<boolean>(true);
}

/** Helper: mapea el `status` booleano del backend a tono + etiqueta. */
export function activeBadge(active: boolean): { tone: BadgeTone; label: string } {
  return active ? { tone: 'ok', label: 'Activo' } : { tone: 'neutral', label: 'Inactivo' };
}
