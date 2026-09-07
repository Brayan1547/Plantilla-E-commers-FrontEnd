import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { HttpAuth } from './http-auth';

/**
 * R1.6 — resolución del destino post-login y prevención de open redirect.
 * Se prueban los helpers privados directamente (contrato de seguridad pequeño
 * y estable); el flujo completo de `loginUser` se cubre en el smoke E2E.
 */
describe('HttpAuth · destino post-login (returnUrl)', () => {
  let auth: HttpAuth;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [HttpAuth, provideHttpClient(), provideRouter([])],
    });
    auth = TestBed.inject(HttpAuth);
  });

  const safe = (u: unknown) => (auth as unknown as { safeInternalUrl: (u: unknown) => string | null }).safeInternalUrl(u);
  const resolve = (role: string | undefined, u?: string | null) =>
    (auth as unknown as { resolvePostLoginUrl: (r: string | undefined, u?: string | null) => string }).resolvePostLoginUrl(role, u);

  it('acepta rutas internas absolutas', () => {
    expect(safe('/admin/products')).toBe('/admin/products');
    expect(safe('/admin/users?tab=1')).toBe('/admin/users?tab=1');
  });

  it('rechaza URLs externas y protocol-relative (open redirect)', () => {
    expect(safe('https://evil.com')).toBeNull();
    expect(safe('http://evil.com/x')).toBeNull();
    expect(safe('//evil.com')).toBeNull();
    expect(safe('/\\evil.com')).toBeNull();
    expect(safe('javascript:alert(1)')).toBeNull();
    expect(safe('')).toBeNull();
    expect(safe(null)).toBeNull();
    expect(safe(undefined)).toBeNull();
  });

  it('administrador / shop_manager / editor: returnUrl válido -> destino solicitado; si no -> /admin', () => {
    expect(resolve('administrador', '/admin/products')).toBe('/admin/products');
    expect(resolve('shop_manager', '/admin/categories')).toBe('/admin/categories');
    // F3 — el rol `editor` YA tiene panel (UI editorial de productos).
    expect(resolve('editor', '/admin/products')).toBe('/admin/products');
    expect(resolve('editor', null)).toBe('/admin');
    expect(resolve('administrador', null)).toBe('/admin');
    expect(resolve('administrador', 'https://evil.com')).toBe('/admin');
  });

  it('subscriber / rol desconocido: siempre /home (ignora returnUrl)', () => {
    expect(resolve('subscriber', '/admin/users')).toBe('/home');
    expect(resolve(undefined, '/admin')).toBe('/home');
  });
});
