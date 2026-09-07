import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';

import ProductDisign from './product-disign';
import { UiModal } from '../../core/services/ui-modal';
import { GuestCart } from '../../core/services/guest-cart';

/**
 * UI-4B-CHECK — regresión de "Agregar al carrito" en la ficha de producto:
 *  - invitado: agrega a GuestCart, muestra toast, NO abre el modal de login;
 *  - autenticado: sigue usando HttpCart (PATCH /cart), NO toca GuestCart.
 */
const VALID_ID = 'a'.repeat(24);

const productData = {
  _id: VALID_ID,
  name: 'Camiseta Essential',
  slug: 'camiseta',
  price: 50000,
  stock: 5,
  images: [],
  isActive: true,
  variants: [],
  categories: [],
};

function setup() {
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
  const uiModal = TestBed.inject(UiModal);
  const guestCart = TestBed.inject(GuestCart);
  const fixture = TestBed.createComponent(ProductDisign);
  fixture.detectChanges(); // ngOnInit -> GET /product/:id
  http.expectOne((r) => r.url.endsWith(`/product/${VALID_ID}`)).flush({ msg: 'ok', data: productData });
  return { http, uiModal, guestCart, fixture, cmp: fixture.componentInstance as any };
}

describe('ProductDisign — agregar al carrito como invitado (UI-4B)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('invitado (sin sesión): addToCart -> GuestCart + toast, sin abrir login, sin PATCH /cart', () => {
    const { cmp, uiModal, guestCart, http } = setup();
    const openSpy = vi.spyOn(uiModal, 'open');

    cmp.addToCart();
    // hidratación del carrito guest recién creado
    http.expectOne((r) => r.url.endsWith(`/product/${VALID_ID}`)).flush({ msg: 'ok', data: productData });

    expect(openSpy).not.toHaveBeenCalled();
    expect(guestCart.lines()).toEqual([{ productId: VALID_ID, quantity: 1 }]);
    http.expectNone((r) => r.method === 'PATCH' && r.url.endsWith('/cart'));
  });

  it('autenticado: addToCart sigue usando HttpCart (PATCH /cart) y NO toca GuestCart', () => {
    const { cmp, guestCart, http } = setup();
    cmp.auth.user = { _id: 'u1', role: 'subscriber' };

    cmp.addToCart();

    const req = http.expectOne((r) => r.method === 'PATCH' && r.url.endsWith('/cart'));
    expect(req.request.body).toEqual({ productId: VALID_ID, quantity: 1 });
    req.flush({ msg: 'ok', data: { items: [] } });
    expect(guestCart.lines()).toEqual([]);
  });
});
