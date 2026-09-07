import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { CartDrawer } from './cart-drawer';
import { GuestCart } from '../../../core/services/guest-cart';
import { HttpCart } from '../../../core/services/http-cart';

/**
 * UI-4B — CartDrawer soporta dos orígenes SIN duplicarse:
 *   invitado -> GuestCart · autenticado -> HttpCart (sin regresión).
 */
const ID_A = 'a'.repeat(24);
const KEY = 'dusck.guestCart.v1';

const publicProduct = (id: string) => ({
  _id: id,
  name: 'Camiseta Essential',
  slug: 'camiseta',
  price: 50000,
  images: [{ url: 'http://x/main.png', isMain: true }],
  categories: [],
  stock: 10,
  isActive: true,
  variants: [],
});

function setup() {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      { provide: PLATFORM_ID, useValue: 'browser' },
    ],
  });
  const http = TestBed.inject(HttpTestingController);
  const guestCart = TestBed.inject(GuestCart);
  const httpCart = TestBed.inject(HttpCart);
  const fixture = TestBed.createComponent(CartDrawer);
  return { http, guestCart, httpCart, fixture };
}

describe('CartDrawer', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('invitado: renderiza el carrito local y permite modificar cantidades', () => {
    localStorage.setItem(KEY, JSON.stringify({ version: 1, items: [{ productId: ID_A, quantity: 2 }] }));
    const { http, guestCart, fixture } = setup();
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges(); // ngOnChanges -> refreshHydration
    http.expectOne((r) => r.url.endsWith(`/product/${ID_A}`)).flush({ msg: 'ok', data: publicProduct(ID_A) });
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Camiseta Essential');

    const cmp = fixture.componentInstance as any;
    cmp.increase(cmp.lines()[0]);
    expect(guestCart.lines()[0].quantity).toBe(3);
    cmp.remove(cmp.lines()[0]);
    expect(guestCart.lines()).toEqual([]);
  });

  it('invitado: subtotal informativo = precio público * cantidad', () => {
    localStorage.setItem(KEY, JSON.stringify({ version: 1, items: [{ productId: ID_A, quantity: 2 }] }));
    const { http, fixture } = setup();
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    http.expectOne((r) => r.url.endsWith(`/product/${ID_A}`)).flush({ msg: 'ok', data: publicProduct(ID_A) });

    expect((fixture.componentInstance as any).subtotal()).toBe(100000);
  });

  it('autenticado: usa HttpCart y NO consulta el carrito guest', () => {
    // Sesión activa -> el drawer decide por httpAuth.user (lee sessionStorage).
    sessionStorage.setItem('token', 'tok');
    sessionStorage.setItem('user', JSON.stringify({ _id: 'u1', role: 'subscriber' }));

    const { http, httpCart, fixture } = setup();
    httpCart.cart.set({
      items: [
        { productId: { _id: ID_A, name: 'Backend Tee', price: 30000, images: [], isActive: true }, quantity: 1 },
      ],
    });
    const cmp = fixture.componentInstance as any;
    expect(cmp.isGuest()).toBe(false);

    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();

    http.expectNone((r) => r.url.includes('/product/'));
    expect(cmp.lines()[0].name).toBe('Backend Tee');
    expect(cmp.subtotal()).toBe(30000);
  });
});
