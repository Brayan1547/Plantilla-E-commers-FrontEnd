import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { IconComponent } from '../../shared/ui/icon/icon';
import { HttpAuth } from '../../../core/services/http-auth';
import { PermissionsService } from '../../core/services/permissions';

@Component({
  selector: 'adm-forbidden',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent],
  host: { class: 'adm' },
  template: `
    <div style="min-height:100vh;display:grid;place-items:center;background:var(--adm-cream);padding:24px">
      <div class="adm-card" style="max-width:440px;text-align:center">
        <div class="adm-card__body adm-stack" style="align-items:center;gap:14px">
          <adm-icon name="lock" [size]="36" class="adm-muted" />
          <h1>Acceso restringido</h1>
          <p class="adm-muted">
            @if (canAccessAdmin()) {
              Tu rol ({{ roleLabel() }}) no tiene permiso para ver esta sección del panel.
            } @else {
              Tu cuenta ({{ roleLabel() }}) no tiene acceso al panel administrativo de VALERY.
            }
          </p>
          <div class="adm-inline" style="justify-content:center">
            @if (canAccessAdmin()) {
              <a class="adm-btn" routerLink="/admin/overview">Ir al inicio del panel</a>
            } @else {
              <a class="adm-btn" href="/home">Volver a la tienda</a>
            }
            <button type="button" class="adm-btn adm-btn--ghost" (click)="logout()">
              Cerrar sesión
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
})
export default class ForbiddenComponent {
  private auth = inject(HttpAuth);
  private router = inject(Router);
  private perms = inject(PermissionsService);

  protected canAccessAdmin = this.perms.canAccessAdmin;
  protected roleLabel(): string {
    const r = this.perms.role();
    return r ?? 'sin rol';
  }

  protected logout(): void {
    this.auth.logoutUser();
    this.router.navigate(['/login']);
  }
}
