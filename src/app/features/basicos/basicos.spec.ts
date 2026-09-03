import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ActivatedRoute, convertToParamMap } from '@angular/router';

import Basicos from './basicos';

/**
 * R2.3 — BÁSICOS. Catálogo público por categoría, datos reales
 * (`GET /api/category` + `GET /api/product`). Solo activos.
 */
describe('Basicos (storefront)', () => {
  let httpMock: HttpTestingController;

  const CATEGORIES = [
    { _id: 'c1', name: 'Camisetas', slug: 'camisetas', isActive: true },
    { _id: 'c2', name: 'Pantalones', slug: 'pantalones', isActive: true },
    { _id: 'c3', name: 'Accesorios', slug: 'accesorios', isActive: false },
  ];
  const PRODUCTS = [
    { _id: 'p1', name: 'Camiseta Negra', price: 89000, stock: 5, isActive: true, categories: ['c1'], images: [] },
    { _id: 'p2', name: 'Pantalón Gris', price: 219000, stock: 0, isActive: true, categories: ['c2'], images: [] },
    { _id: 'p3', name: 'Borrador', price: 10, stock: 1, isActive: false, categories: ['c1'], images: [] },
  ];

  function setup(queryParams: Record<string, string> = {}) {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(queryParams) } },
        },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(Basicos);
    fixture.detectChanges(); // dispara ngOnInit
    return fixture;
  }

  function flush(categories = CATEGORIES, products = PRODUCTS) {
    httpMock.expectOne((r) => r.url.endsWith('/category')).flush({ msg: 'ok', data: categories });
    httpMock.expectOne((r) => r.url.endsWith('/product')).flush({ msg: 'ok', data: products });
  }

  afterEach(() => httpMock.verify());

  it('carga solo categorías activas', () => {
    const f = setup();
    flush();
    const cmp = f.componentInstance as any;
    expect(cmp.categories().map((c: any) => c.slug)).toEqual(['camisetas', 'pantalones']);
  });

  it('muestra solo productos activos (excluye isActive:false)', () => {
    const f = setup();
    flush();
    const cmp = f.componentInstance as any;
    expect(cmp.products().map((p: any) => p._id)).toEqual(['p1', 'p2']);
    expect(cmp.visibleProducts().length).toBe(2);
  });

  it('preselecciona la categoría de ?categoria=<slug> y filtra sus productos', () => {
    const f = setup({ categoria: 'camisetas' });
    flush();
    const cmp = f.componentInstance as any;
    expect(cmp.selectedCategoryId()).toBe('c1');
    expect(cmp.visibleProducts().map((p: any) => p._id)).toEqual(['p1']);
  });

  it('categoría inexistente en ?categoria -> estado "categoría no encontrada", sin productos', () => {
    const f = setup({ categoria: 'hombre' });
    flush();
    const cmp = f.componentInstance as any;
    expect(cmp.unknownCategory()).toBe('hombre');
    expect(cmp.visibleProducts().length).toBe(0);
  });

  it('categoría inactiva en ?categoria -> tratada como no encontrada (no navegable)', () => {
    const f = setup({ categoria: 'accesorios' });
    flush();
    const cmp = f.componentInstance as any;
    expect(cmp.unknownCategory()).toBe('accesorios');
  });

  it('error de API -> estado de error', () => {
    const f = setup();
    httpMock.expectOne((r) => r.url.endsWith('/category')).flush({ data: [] });
    httpMock
      .expectOne((r) => r.url.endsWith('/product'))
      .flush('boom', { status: 500, statusText: 'Server Error' });
    expect((f.componentInstance as any).error()).toBe(true);
  });
});
