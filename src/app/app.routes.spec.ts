import { Route } from '@angular/router';
import { routes } from './app.routes';

/**
 * R2.3 — integridad de rutas del storefront. Tras R2.2 (teardown de
 * `/dashboard`) y R2.3 (retiro de `product-ropa`), no debe quedar ninguna
 * ruta legacy declarada.
 */
describe('app.routes — integridad', () => {
  const flatPaths = (rs: Route[], prefix = ''): string[] =>
    rs.flatMap((r) => {
      const p = [prefix, r.path].filter((s) => s !== undefined && s !== '').join('/');
      return [p, ...(r.children ? flatPaths(r.children, p) : [])];
    });

  const paths = flatPaths(routes);

  it('no declara ninguna ruta /dashboard', () => {
    expect(paths.some((p) => p.includes('dashboard'))).toBe(false);
  });

  it('no declara la ruta obsoleta product-ropa', () => {
    expect(paths).not.toContain('product-ropa');
  });

  it('no referencia componentes legacy eliminados', () => {
    const src = JSON.stringify(
      routes.map((r) => r.loadComponent?.toString() ?? r.loadChildren?.toString() ?? ''),
    );
    for (const legacy of [
      'features/dashboard',
      'product-list/product-list',
      'product-new-form',
      'product-edit-form',
      'category-new-form',
      'category-edit-form',
      'user-list/user-list',
      'user-new-form',
      'user-edit-form',
    ]) {
      expect(src).not.toContain(legacy);
    }
  });

  it('conserva las rutas públicas del storefront', () => {
    for (const p of ['home', 'basicos', 'colecciones', 'category-list', 'tienda/producto/:id', '404']) {
      expect(paths).toContain(p);
    }
  });

  it('mantiene el comodín -> 404 para URLs desconocidas (incluidas /dashboard/*)', () => {
    const wildcard = routes.find((r) => r.path === '**');
    expect(wildcard?.redirectTo).toBe('404');
  });
});
