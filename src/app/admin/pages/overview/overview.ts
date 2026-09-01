import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { toSignal } from '@angular/core/rxjs-interop';

import { PageHeaderComponent } from '../../shared/ui/page-header/page-header';
import { IconComponent } from '../../shared/ui/icon/icon';
import { HttpAuth } from '../../../core/services/http-auth';
import { PermissionsService } from '../../core/services/permissions';
import { ROLE_LABELS } from '../../core/models/permission.model';
import { ADMIN_NAV, type NavItem } from '../../layout/admin-nav';

/**
 * Inicio del panel (FOUNDATION). No es el "Dashboard de métricas" del
 * requerimiento: las KPIs de ventas, gráficas, tráfico y alertas dependen de
 * modelos que el backend aún no tiene (pedidos, analítica, inventario por
 * variante...). Ver PENDING BACKEND. Aquí NO se muestran cifras inventadas.
 */
@Component({
  selector: 'adm-overview',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, PageHeaderComponent, IconComponent],
  template: `
    <adm-page-header
      [title]="'Hola, ' + name()"
      [subtitle]="'Sesión activa como ' + roleLabel() + '. Selecciona un módulo para empezar.'" />

    <div class="adm-kpi-grid" style="margin-bottom:24px">
      @for (item of modules(); track item.route) {
        <a class="adm-kpi" [routerLink]="item.route" style="text-decoration:none">
          <span class="adm-inline">
            <span class="adm-nav-item__icon" style="color:var(--adm-accent)">
              <adm-icon [name]="item.icon" [size]="20" />
            </span>
            <span class="adm-kpi__value adm-kpi__value--muted" style="font-size:16px;color:var(--adm-ink)">
              {{ item.label }}
            </span>
          </span>
          <span class="adm-kpi__compare">Abrir módulo →</span>
        </a>
      }
    </div>

    <div class="adm-card">
      <div class="adm-card__header"><h2>Panel de métricas</h2></div>
      <div class="adm-card__body adm-stack">
        <p class="adm-muted">
          El dashboard de indicadores (ventas del día/mes/año, ingresos netos,
          ticket promedio, conversión, gráficas de ventas y categorías, tráfico y
          alertas operativas) todavía <strong>no tiene backend</strong>. Se
          activará cuando existan los modelos de pedidos, analítica e inventario.
        </p>
        <p class="adm-muted" style="font-size:12.5px">
          Módulos disponibles hoy con API real: usuarios, roles (solo lectura),
          productos, inventario (stock) y categorías.
        </p>
      </div>
    </div>
  `,
})
export default class OverviewComponent {
  private perms = inject(PermissionsService);
  private auth = inject(HttpAuth);

  private user = toSignal(this.auth.user$, { initialValue: this.auth.user });
  protected name = computed(() => (this.user()?.name ?? 'Administrador').split(' ')[0]);
  protected roleLabel = computed(() => {
    const r = this.perms.role();
    return r ? ROLE_LABELS[r] : '—';
  });

  protected modules = computed<NavItem[]>(() =>
    ADMIN_NAV.flatMap((s) => s.items).filter(
      (i) => i.route !== '/admin/overview' && this.perms.canAny(i.permissions),
    ),
  );
}
