import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { GuestCart } from './guest-cart';

/**
 * UI-4B — GuestCart. Contrato crítico: en localStorage SOLO `{productId,
 * quantity}`, SSR-safe, tolerante a datos corruptos, dedupe por productId,
 * quantity entero 1..50.
 */
const KEY = 'dusck.guestCart.v1';
const ID_A = 'a'.repeat(24);
const ID_B = 'b'.repeat(24);

const publicProduct = (id: string, over: Record<string, unknown> = {}) => ({
  _id: id,
  name: `Producto ${id.slice(0, 4)}`,
  slug: id.slice(0, 6),
  price: 50000,
  images: [{ url: 'http://x/main.png', isMain: true }],
  categories: [],
  stock: 10,
  isActive: true,
  variants: [],
  ...over,
});

function make(platform: 'browser' | 'server' = 'browser') {
  TestBed.configureTestingModule({
    providers: [
      GuestCart,
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: PLATFORM_ID, useValue: platform },
    ],
  });
  return {
    svc: TestBed.inject(GuestCart),
    http: TestBed.inject(HttpTestingController),
  };
}

/** Responde a las peticiones de hidratación pendientes. */
function hydrate(http: HttpTestingController, map: Record<string, unknown | null>) {
  for (const [id, product] of Object.entries(map)) {
    const req = http.expectOne((r) => r.url.endsWith(`/product/${id}`));
    if (product === null) {
      req.flush({ msg: 'no disponible' }, { status: 404, statusText: 'Not Found' });
    } else {
      req.flush({ msg: 'ok', data: product });
    }
  }
}

describe('GuestCart', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('carga vacío cuando localStorage no tiene nada', () => {
    const { svc } = make();
    expect(svc.lines()).toEqual([]);
    expect(svc.count()).toBe(0);
    expect(svc.isEmpty()).toBe(true);
  });

  it('carga y sanea líneas válidas desde localStorage', () => {
    localStorage.setItem(KEY, JSON.stringify({ version: 1, items: [{ productId: ID_A, quantity: 3 }] }));
    const { svc } = make();
    expect(svc.lines()).toEqual([{ productId: ID_A, quantity: 3 }]);
    expect(svc.count()).toBe(3);
  });

  it('JSON corrupto -> carrito vacío, sin lanzar', () => {
    localStorage.setItem(KEY, '{ esto no es json');
    const { svc } = make();
    expect(svc.lines()).toEqual([]);
  });

  it('estructura inválida (id/quantity no válidos, entradas basura) -> se descarta', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ items: [{ productId: 'corto', quantity: 2 }, { productId: ID_A, quantity: 'x' }, 5, null] }),
    );
    const { svc } = make();
    expect(svc.lines()).toEqual([]);
  });

  it('dedupe por productId al cargar (suma y acota a 50)', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ items: [{ productId: ID_A, quantity: 40 }, { productId: ID_A, quantity: 30 }] }),
    );
    const { svc } = make();
    expect(svc.lines()).toEqual([{ productId: ID_A, quantity: 50 }]);
  });

  it('add crea la línea y persiste SOLO {productId, quantity}', () => {
    const { svc, http } = make();
    svc.add(ID_A, 2);
    hydrate(http, { [ID_A]: publicProduct(ID_A) });

    expect(svc.lines()).toEqual([{ productId: ID_A, quantity: 2 }]);
    const stored = JSON.parse(localStorage.getItem(KEY)!);
    expect(stored.items).toEqual([{ productId: ID_A, quantity: 2 }]);
    // Nada de precio/nombre/imagen/PII en el almacenamiento.
    expect(JSON.stringify(stored)).not.toMatch(/price|name|image|token|email/i);
  });

  it('add repetido acumula (dedupe), sin nueva petición de hidratación', () => {
    const { svc, http } = make();
    svc.add(ID_A, 2);
    hydrate(http, { [ID_A]: publicProduct(ID_A) });
    svc.add(ID_A, 3);
    http.expectNone((r) => r.url.endsWith(`/product/${ID_A}`));
    expect(svc.lines()).toEqual([{ productId: ID_A, quantity: 5 }]);
  });

  it('add acota la cantidad a 50', () => {
    const { svc, http } = make();
    svc.add(ID_A, 999);
    hydrate(http, { [ID_A]: publicProduct(ID_A) });
    expect(svc.lines()[0].quantity).toBe(50);
  });

  it('increment / decrement; decrement a 0 elimina la línea', () => {
    const { svc, http } = make();
    svc.add(ID_A, 1);
    hydrate(http, { [ID_A]: publicProduct(ID_A) });
    svc.increment(ID_A);
    expect(svc.lines()[0].quantity).toBe(2);
    svc.decrement(ID_A);
    svc.decrement(ID_A);
    expect(svc.lines()).toEqual([]);
    expect(JSON.parse(localStorage.getItem(KEY)!).items).toEqual([]);
  });

  it('remove elimina una línea; clear vacía todo y borra localStorage', () => {
    const { svc, http } = make();
    svc.add(ID_A, 1);
    svc.add(ID_B, 2);
    hydrate(http, { [ID_A]: publicProduct(ID_A), [ID_B]: publicProduct(ID_B) });
    svc.remove(ID_A);
    expect(svc.lines()).toEqual([{ productId: ID_B, quantity: 2 }]);
    svc.clear();
    expect(svc.lines()).toEqual([]);
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('hydrated expone el producto público; 404 -> unavailable, sin borrar la línea', () => {
    const { svc, http } = make();
    svc.add(ID_A, 1);
    svc.add(ID_B, 1);
    hydrate(http, { [ID_A]: publicProduct(ID_A), [ID_B]: null });
    const h = svc.hydrated();
    expect(h.find((l) => l.productId === ID_A)?.product?.name).toContain('Producto');
    const bad = h.find((l) => l.productId === ID_B);
    expect(bad?.unavailable).toBe(true);
    expect(svc.lines().length).toBe(2); // la línea problemática NO se elimina en silencio
  });

  it('SSR: no accede a localStorage y no lanza peticiones', () => {
    const { svc, http } = make('server');
    svc.add(ID_A, 2);
    http.expectNone(() => true);
    expect(svc.count()).toBe(2); // estado en memoria
    expect(localStorage.getItem(KEY)).toBeNull(); // no se persistió
  });
});
