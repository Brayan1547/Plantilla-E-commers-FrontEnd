import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { IconComponent } from '../../shared/ui/icon/icon';
import { PermissionsService } from '../../core/services/permissions';
import { ADMIN_NAV, type NavSection } from '../admin-nav';

@Component({
  selector: 'adm-sidebar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, IconComponent],
  template: `
    <aside class="adm-sidebar" [attr.data-collapsed]="collapsed() ? 'true' : null">
      <div class="adm-sidebar__brand">
        DUSCK
        <small>Admin</small>
      </div>

      <nav class="adm-sidebar__nav" aria-label="Navegación principal">
        @for (section of visibleNav(); track section.title) {
          <div class="adm-sidebar__section">{{ section.title }}</div>
          @for (item of section.items; track item.route) {
            <a
              class="adm-nav-item"
              [routerLink]="item.route"
              routerLinkActive="is-active"
              [routerLinkActiveOptions]="{ exact: false }"
              (click)="navigate.emit()">
              <span class="adm-nav-item__icon"><adm-icon [name]="item.icon" [size]="18" /></span>
              <span class="adm-nav-item__label">{{ item.label }}</span>
            </a>
          }
        }
      </nav>
    </aside>
  `,
})
export class SidebarComponent {
  private perms = inject(PermissionsService);

  collapsed = input<boolean>(false);
  /** Se emite al pulsar un enlace (para cerrar el drawer en móvil). */
  navigate = output<void>();

  protected visibleNav = computed<NavSection[]>(() =>
    ADMIN_NAV.map((section) => ({
      ...section,
      items: section.items.filter((i) => this.perms.canAny(i.permissions)),
    })).filter((section) => section.items.length > 0),
  );
}
