import { ChangeDetectionStrategy, Component, ElementRef, HostListener, computed, inject, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';

import { IconComponent } from '../../shared/ui/icon/icon';
import { HttpAuth } from '../../../core/services/http-auth';
import { PermissionsService } from '../../core/services/permissions';
import { ROLE_LABELS } from '../../core/models/permission.model';

@Component({
  selector: 'adm-topbar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <header class="adm-topbar">
      <button type="button" class="adm-icon-btn adm-topbar__burger"
        aria-label="Abrir menú" (click)="toggleMobile.emit()">
        <adm-icon name="menu" [size]="20" />
      </button>

      <button type="button" class="adm-icon-btn adm-topbar__collapse" aria-label="Colapsar menú"
        (click)="toggleCollapse.emit()">
        <adm-icon name="chevron-left" [size]="18" />
      </button>

      <!-- Identidad del panel (texto estático, sin datos derivados). -->
      <span class="adm-topbar__brand">
        <span class="adm-topbar__brand-name">VALERY</span>
        <span class="adm-topbar__brand-tag">Panel</span>
      </span>

      <!-- Búsqueda global: sin backend -> indicador presentacional, fuera del
           árbol accesible (ya no es un <input disabled>). -->
      <div class="adm-topbar__search" aria-hidden="true">
        <adm-icon name="search" [size]="16" />
        <span>Búsqueda global — requiere backend</span>
      </div>

      <span class="adm-topbar__spacer"></span>

      <!-- Notificaciones: sin backend -> panel vacío honesto. -->
      <div style="position:relative" #notif>
        <button type="button" class="adm-icon-btn" aria-label="Notificaciones"
          [attr.aria-expanded]="notifOpen()" (click)="toggle('notif')">
          <adm-icon name="bell" [size]="18" />
        </button>
        @if (notifOpen()) {
          <div class="adm-popover" role="menu">
            <div class="adm-popover__header"><strong>Notificaciones</strong></div>
            <p class="adm-popover__empty">
              El centro de notificaciones requiere backend (stock, pedidos, pagos,
              soporte, sistema, seguridad). No hay datos que mostrar.
            </p>
          </div>
        }
      </div>

      <!-- Cuenta -->
      <div style="position:relative" #account>
        <button type="button" class="adm-account"
          [attr.aria-expanded]="accountOpen()" (click)="toggle('account')">
          <span class="adm-avatar">
            @if (avatar()) { <img [src]="avatar()" alt="" /> } @else { {{ initials() }} }
          </span>
          <span class="adm-account__meta">
            <span class="adm-account__name">{{ name() }}</span>
            <span class="adm-account__role">{{ roleLabel() }}</span>
          </span>
          <adm-icon name="chevron-down" [size]="14" />
        </button>
        @if (accountOpen()) {
          <div class="adm-popover" role="menu">
            <div class="adm-popover__header">
              <div class="adm-account__name">{{ name() }}</div>
              <div class="adm-muted" style="font-size:12px">{{ email() }}</div>
              <div class="adm-account__role" style="margin-top:4px">{{ roleLabel() }}</div>
            </div>
            <button type="button" class="adm-popover__item" (click)="logout()">
              <adm-icon name="logout" [size]="16" />
              Cerrar sesión
            </button>
          </div>
        }
      </div>
    </header>
  `,
})
export class TopbarComponent {
  private auth = inject(HttpAuth);
  private perms = inject(PermissionsService);
  private router = inject(Router);
  private host = inject(ElementRef<HTMLElement>);

  toggleMobile = output<void>();
  toggleCollapse = output<void>();

  protected notifOpen = signal(false);
  protected accountOpen = signal(false);

  private currentUser = toSignal(this.auth.user$, { initialValue: this.auth.user });

  protected name = computed(() => this.currentUser()?.name ?? 'Administrador');
  protected email = computed(() => this.currentUser()?.email ?? '');
  protected avatar = computed(() => this.currentUser()?.avatar || '');
  protected roleLabel = computed(() => {
    const r = this.perms.role();
    return r ? ROLE_LABELS[r] : '—';
  });
  protected initials = computed(() => {
    const n = (this.currentUser()?.name ?? 'A').trim();
    const parts = n.split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] ?? 'A') + (parts[1]?.[0] ?? '')).toUpperCase();
  });

  protected toggle(which: 'notif' | 'account'): void {
    if (which === 'notif') {
      this.notifOpen.update((v) => !v);
      this.accountOpen.set(false);
    } else {
      this.accountOpen.update((v) => !v);
      this.notifOpen.set(false);
    }
  }

  @HostListener('document:click', ['$event'])
  onDocClick(e: MouseEvent): void {
    if (!this.host.nativeElement.contains(e.target as Node)) {
      this.notifOpen.set(false);
      this.accountOpen.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEsc(): void {
    this.notifOpen.set(false);
    this.accountOpen.set(false);
  }

  protected logout(): void {
    this.auth.logoutUser();
    this.router.navigate(['/login']);
  }
}
