import { Component, computed, inject, signal } from '@angular/core';
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
}
