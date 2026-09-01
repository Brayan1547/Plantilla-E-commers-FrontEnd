import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { PageHeaderComponent } from '../page-header/page-header';
import { EmptyStateComponent } from '../states/empty-state';

/**
 * Marcador honesto para un módulo cuyo backend YA existe pero cuya UI se
 * implementa en el siguiente bloque de trabajo. No muestra datos ni llama a
 * ningún endpoint: solo deja el layout, el routing y los permisos operativos.
 *
 * Se reemplazará por la implementación real (lista + detalle + formularios).
 */
@Component({
  selector: 'adm-module-stub',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, EmptyStateComponent],
  template: `
    <adm-page-header [title]="title()" [subtitle]="subtitle()" />
    <div class="adm-card">
      <adm-empty-state
        icon="box"
        title="Módulo en implementación"
        [message]="
          'El backend de ' +
          title().toLowerCase() +
          ' está disponible. La interfaz completa (listado, filtros, detalle y formularios) se entrega en el siguiente bloque.'
        " />
    </div>
  `,
})
export class ModuleStubComponent {
  title = input.required<string>();
  subtitle = input<string>('');
}
