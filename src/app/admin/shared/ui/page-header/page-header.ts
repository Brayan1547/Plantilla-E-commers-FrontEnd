import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'adm-page-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="adm-page-header">
      <div class="adm-page-header__titles">
        <h1>{{ title() }}</h1>
        @if (subtitle()) {
          <p class="adm-page-header__subtitle">{{ subtitle() }}</p>
        }
      </div>
      <div class="adm-page-header__actions">
        <ng-content select="[actions]" />
      </div>
    </header>
  `,
})
export class PageHeaderComponent {
  title = input.required<string>();
  subtitle = input<string>('');
}
