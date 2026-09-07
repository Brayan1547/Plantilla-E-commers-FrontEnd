import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';

import Checkout from './checkout';

/**
 * UI-4B — Checkout. Cubre: fuente de ítems (guest / auth), payload exacto,
 * Idempotency-Key, bloqueo de doble submit, limpieza del carrito guest SOLO tras
 * 201, preservación del carrito ante error, validaciones y flujo autenticado.
 */
const KEY = 'dusck.guestCart.v1';
const ID_A = 'a'.repeat(24);

const publicProduct = (id: string, over: Record<string, unknown> = {}) => ({
  _id: id,
  name: 'Camiseta Essential',
  slug: 'camiseta',
  price: 50000,
  images: [{ url: 'http://x/main.png', isMain: true }],
  categories: [],
  stock: 10,
  isActive: true,
  variants: [],
  ...over,
});

const ORDER_201 = {
  id: 'order1',
  orderNumber: 'DUSCK-2026-000001',
  status: 'pending_confirmation',
  userId: null,
  items: [
    {
      productId: ID_A,
      productName: 'Camiseta Essential',
      slug: 'camiseta',
      image: null,
      unitPrice: 50000,
      quantity: 2,
      subtotal: 100000,
    },
  ],
  totals: { itemsSubtotal: 100000, shipping: 0, grandTotal: 100000, currency: 'COP' },
  payment: { method: 'cash_on_delivery', status: 'pending' },
  customer: { recipientName: 'Ana Gómez', phone: '3001234567', email: 'ana@dusck.co' },
  shippingAddress: {
    department: 'Antioquia',
    city: 'Medellín',
    neighborhood: 'Laureles',
    address: 'Calle 12 # 34-56',
  },
  createdAt: new Date().toISOString(),
};

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
  const router = TestBed.inject(Router);
  const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
  const fixture = TestBed.createComponent(Checkout);
  const cmp = fixture.componentInstance as any;
  fixture.detectChanges(); // ngOnInit
  return { http, router, navSpy, fixture, cmp };
}

const fillValid = (cmp: any) =>
  cmp.form.patchValue({
    recipientName: 'Ana Gómez',
    phone: '3001234567',
    email: 'ana@dusck.co',
    department: 'Antioquia',
    city: 'Medellín',
    neighborhood: 'Laureles',
    address: 'Calle 12 # 34-56',
  });

const flushProduct = (http: HttpTestingController, id = ID_A, over = {}) =>
  http.expectOne((r) => r.url.endsWith(`/product/${id}`)).flush({ msg: 'ok', data: publicProduct(id, over) });

describe('Checkout (invitado)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem(KEY, JSON.stringify({ version: 1, items: [{ productId: ID_A, quantity: 2 }] }));
  });
  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('toma los ítems del carrito guest y arma el payload EXACTO', () => {
    const { http, cmp } = setup();
    flushProduct(http);
    fillValid(cmp);

    cmp.submit();

    const req = http.expectOne((r) => r.url.endsWith('/orders'));
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('Idempotency-Key')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(req.request.body).toEqual({
      items: [{ productId: ID_A, quantity: 2 }],
      customer: { recipientName: 'Ana Gómez', phone: '3001234567', email: 'ana@dusck.co' },
      shippingAddress: {
        department: 'Antioquia',
        city: 'Medellín',
        neighborhood: 'Laureles',
        address: 'Calle 12 # 34-56',
      },
    });
    req.flush({ msg: 'ok', data: ORDER_201 });
  });

  it('éxito 201 -> limpia el carrito guest y navega a la confirmación con el pedido', () => {
    const { http, cmp, navSpy } = setup();
    flushProduct(http);
    fillValid(cmp);
    cmp.submit();
    http.expectOne((r) => r.url.endsWith('/orders')).flush({ msg: 'ok', data: ORDER_201 });

    expect(localStorage.getItem(KEY)).toBeNull();
    expect(navSpy).toHaveBeenCalledWith(['/checkout/confirmacion'], { state: { order: ORDER_201 } });
  });

  it('doble click -> una sola petición POST', () => {
    const { http, cmp } = setup();
    flushProduct(http);
    fillValid(cmp);

    cmp.submit();
    cmp.submit();
    cmp.submit();

    expect(http.match((r) => r.url.endsWith('/orders')).length).toBe(1);
  });

  it('error del backend -> conserva el carrito guest y muestra mensaje', () => {
    const { http, cmp } = setup();
    flushProduct(http);
    fillValid(cmp);
    cmp.submit();
    http
      .expectOne((r) => r.url.endsWith('/orders'))
      .flush({ msg: 'error interno' }, { status: 500, statusText: 'Server Error' });

    expect(localStorage.getItem(KEY)).not.toBeNull();
    expect(cmp.errorMessage()).toBeTruthy();
    expect(cmp.submitting()).toBe(false);
  });

  it('reintento tras error usa la MISMA Idempotency-Key', () => {
    const { http, cmp } = setup();
    flushProduct(http);
    fillValid(cmp);
    cmp.submit();
    const first = http.expectOne((r) => r.url.endsWith('/orders'));
    const key1 = first.request.headers.get('Idempotency-Key');
    first.flush({ msg: 'conflicto' }, { status: 409, statusText: 'Conflict' });

    cmp.submit();
    const second = http.expectOne((r) => r.url.endsWith('/orders'));
    expect(second.request.headers.get('Idempotency-Key')).toBe(key1);
    second.flush({ msg: 'ok', data: ORDER_201 });
  });

  it('formulario inválido -> no hace POST y marca el error', () => {
    const { http, cmp } = setup();
    flushProduct(http);

    cmp.submit();

    http.expectNone((r) => r.url.endsWith('/orders'));
    expect(cmp.errorMessage()).toBeTruthy();
    expect(cmp.form.touched).toBe(true);
  });

  it('carrito vacío -> no hace POST', () => {
    localStorage.clear();
    const { http, cmp } = setup();
    fillValid(cmp);

    cmp.submit();

    http.expectNone((r) => r.url.endsWith('/orders'));
    expect(cmp.isEmpty()).toBe(true);
  });

  it('producto no disponible -> bloquea el envío', () => {
    const { http, cmp } = setup();
    http.expectOne((r) => r.url.endsWith(`/product/${ID_A}`)).flush({ msg: 'no' }, { status: 404, statusText: 'Not Found' });
    fillValid(cmp);

    cmp.submit();

    http.expectNone((r) => r.url.endsWith('/orders'));
    expect(cmp.hasUnavailable()).toBe(true);
  });
});

describe('Checkout (autenticado)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    sessionStorage.setItem('token', 'tok');
    sessionStorage.setItem('user', JSON.stringify({ _id: 'u1', name: 'Cliente', role: 'subscriber' }));
  });
  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  const flushMyCart = (http: HttpTestingController) =>
    http.expectOne((r) => r.url.endsWith('/cart') && r.method === 'GET').flush({
      msg: 'ok',
      cart: {
        items: [
          { productId: { _id: ID_A, name: 'Camiseta', price: 50000, images: [], stock: 5, isActive: true }, quantity: 1 },
        ],
      },
    });

  it('usa el carrito de backend y sincroniza el estado local tras el 201', () => {
    const { http, cmp } = setup();
    flushMyCart(http);
    fillValid(cmp);

    cmp.submit();
    const req = http.expectOne((r) => r.url.endsWith('/orders'));
    expect(req.request.body.items).toEqual([{ productId: ID_A, quantity: 1 }]);
    req.flush({ msg: 'ok', data: { ...ORDER_201, userId: 'u1' } });

    // El carrito guest local NUNCA se toca en el flujo autenticado.
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('401 al enviar -> sesión expirada, decisión explícita, carrito conservado', () => {
    const { http, cmp, navSpy } = setup();
    flushMyCart(http);
    fillValid(cmp);

    cmp.submit();
    http.expectOne((r) => r.url.endsWith('/orders')).flush({ msg: 'token' }, { status: 401, statusText: 'Unauthorized' });

    expect(cmp.sessionExpired()).toBe(true);
    expect(cmp.errorMessage()).toContain('sesión');
    expect(navSpy).not.toHaveBeenCalled();

    // El usuario decide explícitamente continuar como invitado.
    cmp.continuarComoInvitado();
    expect(cmp.isGuest()).toBe(true);
    expect(JSON.parse(localStorage.getItem(KEY)!).items).toEqual([{ productId: ID_A, quantity: 1 }]);
  });
});
