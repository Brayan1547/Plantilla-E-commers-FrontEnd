import { Component, computed, effect, inject, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';

import { Header } from "./shared/components/header/header";
import { Footer } from "./shared/components/footer/footer";
import { ToastComponent } from './shared/components/toast/toast';


@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Header, Footer, ToastComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('frontEND');

  private router = inject(Router);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  // El Admin Panel trae su propio layout (sidebar + topbar); en esas rutas se
  // ocultan el header y footer publicos de la tienda.
  private currentUrl = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map((e) => (e as NavigationEnd).urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  protected readonly isAdminRoute = computed(() =>
    this.currentUrl().split('?')[0].startsWith('/admin'),
  );

  // `/login` y `/register` son paginas de autenticacion standalone: no muestran
  // el header ni el footer del storefront.
  protected readonly isAuthRoute = computed(() => {
    const path = this.currentUrl().split('?')[0];
    return path === '/login' || path === '/register';
  });

  constructor() {
    // `has-fixed-header` la administra el Header del storefront para reservar el
    // alto de la barra fija. En las rutas SIN header del storefront (auth y todo
    // `/admin/**`) esa clase descuadra el layout (padding-top: 72px sobre el
    // body). Ademas, la suscripcion del Header a `router.events` puede seguir
    // viva tras desmontarse y volver a anadir la clase en CADA navegacion, por
    // lo que se reconcilia aqui leyendo `currentUrl()` directamente (se re-
    // ejecuta en cada NavigationEnd) — con la misma senal de navegacion que
    // decide el shell, sin timeouts ni offsets. Fuera de esas rutas, el Header
    // sigue siendo la unica autoridad sobre la clase.
    effect(() => {
      const path = this.currentUrl().split('?')[0];
      const headerlessRoute =
        path === '/login' || path === '/register' || path.startsWith('/admin');
      if (this.isBrowser && headerlessRoute) {
        document.body.classList.remove('has-fixed-header');
      }
    });
  }
}
