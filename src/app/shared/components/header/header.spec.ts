import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { Header } from './header';
import { UiModal } from '../../../core/services/ui-modal';

/**
 * UI-4B-CHECK — regresión del carrito de invitado en el Header:
 *  - el icono de carrito abre el drawer, NUNCA el modal de login;
 *  - el badge usa GuestCart.count() para invitado y HttpCart.cartCount() con sesión.
 */
const GUEST_KEY = 'dusck.guestCart.v1';
const ID_A = 'a'.repeat(24);

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
  const uiModal = TestBed.inject(UiModal);
  const fixture = TestBed.createComponent(Header);
  const cmp = fixture.componentInstance as any;
  return { http, uiModal, fixture, cmp };
}

describe('Header (UI-4B carrito de invitado)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('invitado: el icono de carrito abre el drawer y NO abre el modal de login', () => {
    const { cmp, uiModal, fixture } = setup();
    const openSpy = vi.spyOn(uiModal, 'open');

    cmp.onCartIconClick();

    expect(cmp.cartDrawerOpen).toBe(true);
    expect(openSpy).not.toHaveBeenCalled();
    fixture.destroy();
  });

  it('invitado: el badge refleja GuestCart.count()', () => {
    localStorage.setItem(
      GUEST_KEY,
      JSON.stringify({ version: 1, items: [{ productId: ID_A, quantity: 3 }] }),
    );
    const { cmp, fixture } = setup();
    expect(cmp.cartBadgeCount).toBe(3);
    fixture.destroy();
  });

  it('autenticado: el badge refleja HttpCart.cartCount()', () => {
    sessionStorage.setItem('token', 'tok');
    sessionStorage.setItem('user', JSON.stringify({ _id: 'u1', role: 'subscriber' }));

    const { cmp, http, fixture } = setup();
    // El constructor del Header dispara getMyCart() cuando hay sesión.
    http
      .expectOne((r) => r.url.endsWith('/cart') && r.method === 'GET')
      .flush({ msg: 'ok', cart: { items: [{ productId: { _id: 'x' }, quantity: 5 }] } });

    expect(cmp.cartBadgeCount).toBe(5);
    fixture.destroy();
  });
});
