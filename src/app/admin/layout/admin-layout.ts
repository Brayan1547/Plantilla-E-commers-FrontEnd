import { ChangeDetectionStrategy, Component, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';

import { SidebarComponent } from './sidebar/sidebar';
import { TopbarComponent } from './topbar/topbar';
import { BreadcrumbsComponent } from './breadcrumbs/breadcrumbs';

const COLLAPSE_KEY = 'adm.sidebar.collapsed';

/**
 * Shell del Admin Panel: sidebar + topbar + breadcrumbs + contenido enrutado.
 * La clase `.adm` en el host habilita los tokens del design system.
 */
@Component({
  selector: 'adm-layout',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, SidebarComponent, TopbarComponent, BreadcrumbsComponent],
  host: { class: 'adm', 'data-adm-theme': 'auto' },
  template: `
    <div
      class="adm-shell"
      [attr.data-collapsed]="collapsed()"
      [attr.data-mobile-open]="mobileOpen()">
      <div class="adm-sidebar__scrim" (click)="closeMobile()"></div>

      <adm-sidebar [collapsed]="collapsed() === 'true'" (navigate)="closeMobile()" />

      <div class="adm-shell__main">
        <adm-topbar (toggleMobile)="toggleMobile()" (toggleCollapse)="toggleCollapse()" />
        <main class="adm-shell__content">
          <adm-breadcrumbs />
          <router-outlet />
        </main>
      </div>
    </div>
  `,
})
export class AdminLayoutComponent {
  private router = inject(Router);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  protected collapsed = signal<'true' | 'false'>(this.readCollapsed());
  protected mobileOpen = signal<'true' | 'false'>('false');

  constructor() {
    // La tienda pública añade `has-fixed-header` al <body>; el panel no la usa.
    if (this.isBrowser) {
      document.body.classList.remove('has-fixed-header');
    }
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => this.closeMobile());
  }

  private readCollapsed(): 'true' | 'false' {
    if (!this.isBrowser) return 'false';
    try {
      return localStorage.getItem(COLLAPSE_KEY) === 'true' ? 'true' : 'false';
    } catch {
      return 'false';
    }
  }

  protected toggleCollapse(): void {
    const next = this.collapsed() === 'true' ? 'false' : 'true';
    this.collapsed.set(next);
    if (this.isBrowser) {
      try {
        localStorage.setItem(COLLAPSE_KEY, next);
      } catch {
        /* almacenamiento no disponible: se ignora */
      }
    }
  }

  protected toggleMobile(): void {
    this.mobileOpen.update((v) => (v === 'true' ? 'false' : 'true'));
  }

  protected closeMobile(): void {
    this.mobileOpen.set('false');
  }
}
