import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map, startWith } from 'rxjs';

import { IconComponent } from '../../shared/ui/icon/icon';

interface Crumb {
  label: string;
  url: string;
  last: boolean;
}

/**
 * Migas de pan derivadas del árbol de rutas activo. Cada ruta declara su
 * etiqueta en `data.breadcrumb` (string). Las rutas sin `breadcrumb` se omiten
 * del rastro pero se conserva su segmento de URL.
 */
@Component({
  selector: 'adm-breadcrumbs',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent],
  template: `
    @if (crumbs().length > 1) {
      <nav class="adm-breadcrumbs" aria-label="Ruta de navegación">
        @for (c of crumbs(); track c.url) {
          @if (c.last) {
            <span class="adm-breadcrumbs__current" aria-current="page">{{ c.label }}</span>
          } @else {
            <a [routerLink]="c.url">{{ c.label }}</a>
            <adm-icon class="adm-breadcrumbs__sep" name="chevron-right" [size]="12" />
          }
        }
      </nav>
    }
  `,
})
export class BreadcrumbsComponent {
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  protected crumbs = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      startWith(null),
      map(() => this.build()),
    ),
    { initialValue: this.build() },
  );

  private build(): Crumb[] {
    const out: Crumb[] = [];
    let node: ActivatedRoute | null = this.route.root;
    let url = '';

    while (node) {
      const segment = node.snapshot.url.map((s) => s.path).join('/');
      if (segment) url += `/${segment}`;
      const label = node.snapshot.data?.['breadcrumb'] as string | undefined;
      if (label) out.push({ label, url, last: false });
      node = node.firstChild;
    }

    if (out.length) out[out.length - 1].last = true;
    return out;
  }
}
