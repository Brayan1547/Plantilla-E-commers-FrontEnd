import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // Admin Panel: panel privado autenticado. No se prerenderiza ni se hace SSR
  // (no aporta SEO y depende de sessionStorage/token en el navegador).
  {
    path: 'admin',
    renderMode: RenderMode.Client,
  },
  {
    path: 'admin/**',
    renderMode: RenderMode.Client,
  },
  // Ficha de producto: SSR bajo demanda (sirve para SEO) sin exigir
  // `getPrerenderParams` como haria RenderMode.Prerender con `:id`.
  {
    path: 'tienda/producto/:id',
    renderMode: RenderMode.Server,
  },
  // Formularios legacy con `:id` bajo /dashboard: no se prerenderizan.
  {
    path: 'dashboard',
    renderMode: RenderMode.Client,
  },
  {
    path: 'dashboard/**',
    renderMode: RenderMode.Client,
  },
  {
    path: '**',
    renderMode: RenderMode.Prerender,
  },
];
