import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';

import ProductDisign from './product-disign';

/**
 * AJUSTE UX — "Añadir al carrito" abre un modal SOLO tras éxito, y "Comprar
 * ahora" reutiliza la misma lógica de carrito y luego navega a `/checkout`.
 * No hay servicio, estado ni ruta nuevos: el checkout lee la línea del carrito.
 */
const VALID_ID = 'a'.repeat(24);

const simple = {
  _id: VALID_ID,
  name: 'Camiseta Essential',
  price: 50000,
  stock: 5,
  images: [],
  isActive: true,
  variants: [],
  categories: [],
};

const multiSize = {
  ...simple,
  stock: 8,
  variants: [
    { color: 'Negro', size: 'S', stock: 5 },
    { color: 'Negro', size: 'M', stock: 3 },
  ],
};

function setup(data: any) {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      { provide: PLATFORM_ID, useValue: 'browser' },
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: VALID_ID }) } } },
    ],
  });
  const http = TestBed.inject(HttpTestingController);
  const router = TestBed.inject(Router);
  const fixture = TestBed.createComponent(ProductDisign);
  fixture.detectChanges();
  http.expectOne((r) => r.url.endsWith(`/product/${VALID_ID}`)).flush({ msg: 'ok', data });
  return { http, router, fixture, cmp: fixture.componentInstance as any };
}

describe('ProductDisign — modal de compra + "Comprar ahora"', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('invitado: addToCart con éxito abre el modal de compra', () => {
    const { cmp, http } = setup(simple);
    cmp.addToCart();
    http.expectOne((r) => r.url.endsWith(`/product/${VALID_ID}`)).flush({ msg: 'ok', data: simple });
    expect(cmp.buyModalOpen()).toBe(true);
  });

  it('validación fallida (talla obligatoria) NO abre el modal', () => {
    const { cmp, http } = setup(multiSize);
    expect(cmp.selectedSize()).toBeNull();
    cmp.addToCart();
    http.expectNone((r) => r.method === 'PATCH' && r.url.endsWith('/cart'));
    expect(cmp.buyModalOpen()).toBe(false);
    expect(cmp.showSizeHint()).toBe(true);
  });

  it('autenticado: error del backend NO abre el modal', () => {
    const { cmp, http } = setup(simple);
    cmp.auth.user = { _id: 'u1', role: 'subscriber' };
    cmp.addToCart();
    http
      .expectOne((r) => r.method === 'PATCH' && r.url.endsWith('/cart'))
      .flush({ msg: 'sin stock' }, { status: 409, statusText: 'Conflict' });
    expect(cmp.buyModalOpen()).toBe(false);
  });

  it('"Comprar ahora" (invitado): agrega al GuestCart y navega a /checkout', () => {
    const { cmp, http, router } = setup(simple);
    const nav = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    cmp.quantity.set(2);
    cmp.buyNow();
    http.expectOne((r) => r.url.endsWith(`/product/${VALID_ID}`)).flush({ msg: 'ok', data: simple });
    expect(cmp.guestCart.lines()).toEqual([{ productId: VALID_ID, quantity: 2 }]);
    expect(nav).toHaveBeenCalledWith('/checkout');
    expect(cmp.buyModalOpen()).toBe(false);
  });

  it('"Comprar ahora" (autenticado): PATCH /cart con talla y cantidad, luego navega a /checkout', () => {
    const { cmp, http, router } = setup(multiSize);
    const nav = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    cmp.auth.user = { _id: 'u1', role: 'subscriber' };
    cmp.selectSize('M');
    cmp.quantity.set(2);
    cmp.buyNow();
    const req = http.expectOne((r) => r.method === 'PATCH' && r.url.endsWith('/cart'));
    expect(req.request.body).toEqual({ productId: VALID_ID, quantity: 2, size: 'M' });
    req.flush({ msg: 'ok', data: { items: [] } });
    expect(nav).toHaveBeenCalledWith('/checkout');
  });

  it('"Comprar ahora" sin talla (producto con variantes): no navega, muestra aviso', () => {
    const { cmp, http, router } = setup(multiSize);
    const nav = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    cmp.buyNow();
    http.expectNone((r) => r.method === 'PATCH' && r.url.endsWith('/cart'));
    expect(nav).not.toHaveBeenCalled();
    expect(cmp.showSizeHint()).toBe(true);
  });
});
