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
  // Rutas publicas que renderizan DATOS de la API. NO se prerenderizan: hacerlo
  // exigiria el backend levantado en build-time (y `environment.apiUrl` es
  // relativo -> una URL relativa no resuelve en el fetch de Node durante el
  // prerender, lo que rompia `npm run build`). Con RenderMode.Server se sirven
  // por SSR bajo demanda: en un deploy donde el backend sea alcanzable desde el
  // servidor de Angular llegan con datos; si no, el shell se sirve al instante y
  // el navegador completa la carga tras hidratar.
  {
    path: 'home',
    renderMode: RenderMode.Server,
  },
  {
    path: 'category-list',
    renderMode: RenderMode.Server,
  },
  {
    // BÁSICOS: renderiza datos de la API (productos + categorías) -> SSR bajo
    // demanda, mismo criterio que 'home' / 'category-list' (no se prerenderiza
    // porque `environment.apiUrl` es relativo y no resuelve en build-time).
    path: 'basicos',
    renderMode: RenderMode.Server,
  },
  {
    // COLECCIONES: contenido estatico (sin fetch), pero se sirve por SSR por
    // consistencia con el resto de rutas publicas del storefront.
    path: 'colecciones',
    renderMode: RenderMode.Server,
  },
  // Ficha de producto: SSR bajo demanda (sirve para SEO) sin exigir
  // `getPrerenderParams` como haria RenderMode.Prerender con `:id`.
  {
    path: 'tienda/producto/:id',
    renderMode: RenderMode.Server,
  },
  // El bloque `dashboard` / `dashboard/**` (legacy, RenderMode.Client) se retiro
  // en R2.2 junto con las rutas. Las URLs antiguas /dashboard/* las absorbe el
  // comodin de app.routes.ts -> redirect a /404.
  {
    path: '**',
    renderMode: RenderMode.Prerender,
  },
];
