import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconComponent, type IconName } from '../icon/icon';

@Component({
  selector: 'adm-empty-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="adm-state">
      <adm-icon class="adm-state__icon" [name]="icon()" [size]="40" />
      <p class="adm-state__title">{{ title() }}</p>
      @if (message()) {
        <p class="adm-state__msg">{{ message() }}</p>
      }
      <ng-content select="[action]" />
    </div>
  `,
})
export class EmptyStateComponent {
  icon = input<IconName>('inbox');
  title = input.required<string>();
  message = input<string>('');
}
