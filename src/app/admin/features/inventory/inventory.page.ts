import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ModuleStubComponent } from '../../shared/ui/module-stub/module-stub';

@Component({
  selector: 'adm-inventory-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModuleStubComponent],
  template: `<adm-module-stub title="Inventario" subtitle="Niveles de stock por producto (disponible / bajo / agotado)." />`,
})
export default class InventoryPage {}
