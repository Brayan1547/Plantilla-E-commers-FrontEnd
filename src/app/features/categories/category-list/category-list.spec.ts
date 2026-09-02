import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import CategoryList from './category-list';

/**
 * R2.3 — Índice público de categorías (`/category-list`). Solo lectura,
 * solo categorías activas, sin UI administrativa.
 */
describe('CategoryList (storefront)', () => {
  let httpMock: HttpTestingController;

  function setup() {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    httpMock = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(CategoryList);
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => httpMock.verify());

  it('lista únicamente categorías activas', () => {
    const f = setup();
    httpMock.expectOne((r) => r.url.endsWith('/category')).flush({
      msg: 'ok',
      data: [
        { _id: 'c1', name: 'Camisetas', slug: 'camisetas', isActive: true },
        { _id: 'c2', name: 'Accesorios', slug: 'accesorios', isActive: false },
      ],
    });
    const cmp = f.componentInstance as any;
    expect(cmp.categories().map((c: any) => c.slug)).toEqual(['camisetas']);
    expect(cmp.loading()).toBe(false);
  });

  it('no enlaza a /dashboard ni expone acciones administrativas en el template', () => {
    const f = setup();
    httpMock.expectOne((r) => r.url.endsWith('/category')).flush({
      msg: 'ok',
      data: [{ _id: 'c1', name: 'Camisetas', slug: 'camisetas', isActive: true }],
    });
    f.detectChanges();
    const html = (f.nativeElement as HTMLElement).innerHTML;
    expect(html).not.toContain('/dashboard');
    expect(html.toLowerCase()).not.toContain('eliminar');
    expect(html).toContain('/basicos'); // navega al catálogo por categoría
  });

  it('error de API -> estado de error', () => {
    const f = setup();
    httpMock
      .expectOne((r) => r.url.endsWith('/category'))
      .flush('x', { status: 503, statusText: 'unavailable' });
    expect((f.componentInstance as any).error()).toBe(true);
  });
});
