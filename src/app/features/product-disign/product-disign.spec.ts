import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, ActivatedRoute, convertToParamMap } from '@angular/router';

import ProductDisign from './product-disign';

/**
 * R2.3 — Ficha pública de producto (`tienda/producto/:id`). Carga el producto
 * REAL con `GET /api/product/:id`. Maneja: válido · no encontrado · id inválido · error.
 */
describe('ProductDisign (product detail)', () => {
  let httpMock: HttpTestingController;
  const VALID_ID = 'a'.repeat(24);

  function setup(id: string | null) {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap(id ? { id } : {}) } },
        },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(ProductDisign);
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => httpMock.verify());

  it('producto válido -> estado "ready" con datos reales', () => {
    const f = setup(VALID_ID);
    httpMock.expectOne((r) => r.url.endsWith(`/product/${VALID_ID}`)).flush({
      msg: 'ok',
      data: { _id: VALID_ID, name: 'Camiseta Negra', price: 89000, stock: 4, description: 'x', images: [] },
    });
    const cmp = f.componentInstance as any;
    expect(cmp.state()).toBe('ready');
    expect(cmp.product().name).toBe('Camiseta Negra');
    expect(cmp.outOfStock()).toBe(false);
  });

  it('respuesta con data vacía -> "not-found"', () => {
    const f = setup(VALID_ID);
    httpMock.expectOne((r) => r.url.endsWith(`/product/${VALID_ID}`)).flush({ msg: 'no existe', data: null });
    expect((f.componentInstance as any).state()).toBe('not-found');
  });

  it('id con forma inválida -> "not-found" SIN llamar a la API', () => {
    const f = setup('123-no-objectid');
    httpMock.expectNone(() => true);
    expect((f.componentInstance as any).state()).toBe('not-found');
  });

  it('404 del backend -> "not-found"', () => {
    const f = setup(VALID_ID);
    httpMock
      .expectOne((r) => r.url.endsWith(`/product/${VALID_ID}`))
      .flush({ msg: 'no encontrado' }, { status: 404, statusText: 'Not Found' });
    expect((f.componentInstance as any).state()).toBe('not-found');
  });

  it('500 del backend -> "error"', () => {
    const f = setup(VALID_ID);
    httpMock
      .expectOne((r) => r.url.endsWith(`/product/${VALID_ID}`))
      .flush('boom', { status: 500, statusText: 'Server Error' });
    expect((f.componentInstance as any).state()).toBe('error');
  });

  it('stock 0 -> outOfStock true', () => {
    const f = setup(VALID_ID);
    httpMock.expectOne((r) => r.url.endsWith(`/product/${VALID_ID}`)).flush({
      msg: 'ok',
      data: { _id: VALID_ID, name: 'Agotada', price: 1, stock: 0, images: [] },
    });
    expect((f.componentInstance as any).outOfStock()).toBe(true);
  });
});
