import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IconComponent } from '../icon/icon';

@Component({
  selector: 'adm-error-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="adm-state">
      <adm-icon class="adm-state__icon" name="alert" [size]="40" />
      <p class="adm-state__title">{{ title() }}</p>
      <p class="adm-state__msg">{{ message() }}</p>
      @if (canRetry()) {
        <button type="button" class="adm-btn adm-btn--ghost adm-btn--sm" (click)="retry.emit()">
          <adm-icon name="refresh" [size]="14" />
          Reintentar
        </button>
      }
    </div>
  `,
})
export class ErrorStateComponent {
  title = input<string>('No se pudo cargar la información');
  message = input.required<string>();
  canRetry = input<boolean>(true);
  retry = output<void>();
}
