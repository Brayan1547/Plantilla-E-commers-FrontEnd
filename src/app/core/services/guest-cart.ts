import { HttpClient, HttpHeaders } from '@angular/common/http';
import { computed, inject, PLATFORM_ID, Service, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { catchError, forkJoin, of } from 'rxjs';

import { environment } from '../../../environments/environment';
import { MAX_ORDER_ITEM_QTY, MIN_ORDER_ITEM_QTY } from '../models/order.model';
import type { PublicProduct } from '../models/public-product.model';

/**
 * UI-4B — Carrito de INVITADO (usuario no autenticado).
 *
 * Reglas críticas (UI-4B §3 / §4):
 *  - El contrato del carrito NO cambia: cada línea es EXCLUSIVAMENTE
 *    `{ productId: string, quantity: number }`. Sin variantId/colorId/sizeId,
 *    sin `Product.stock`, sin `stockOps`, sin campos nuevos.
 *  - En `localStorage` se persiste ÚNICAMENTE `{ productId, quantity }`. NUNCA
 *    precio, nombre, imagen, stock, producto completo, usuario, PII, token,
 *    order ni pago.
 *  - Los datos de producto para pintar la UI se hidratan bajo demanda con el
 *    servicio PÚBLICO de productos existente (`GET /api/product/:id`) y viven
 *    solo en memoria.
 *  - SSR-safe: nunca se toca `localStorage` fuera del navegador.
 *  - Tolerante a datos corruptos previos (JSON inválido, estructura inválida,
 *    cantidades no enteras): se sanea sin romper la app.
 *
 * NO existe endpoint de carrito de invitado y NO se crea. NO se hace merge
 * automático con el carrito autenticado.
 */

/** Línea cruda persistida (lo único que va a `localStorage`). */
export interface GuestCartLine {
  productId: string;
  quantity: number;
}

/** Línea con datos públicos de producto hidratados para la UI (solo memoria). */
export interface GuestCartHydratedLine {
  productId: string;
  quantity: number;
  /** Producto público, o `null` si aún no se ha hidratado / no se pudo. */
  product: PublicProduct | null;
  /** true si el backend indicó que el producto ya no está disponible (404/400). */
  unavailable: boolean;
}

const STORAGE_KEY = 'dusck.guestCart.v1';
const OBJECT_ID_RE = /^[a-f\d]{24}$/i;

const clampQty = (q: number): number => {
  if (!Number.isFinite(q)) return MIN_ORDER_ITEM_QTY;
  const n = Math.trunc(q);
  if (n < MIN_ORDER_ITEM_QTY) return MIN_ORDER_ITEM_QTY;
  if (n > MAX_ORDER_ITEM_QTY) return MAX_ORDER_ITEM_QTY;
  return n;
};

@Service()
export class GuestCart {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private http = inject(HttpClient);
  private readonly PRODUCT_URL = `${environment.apiUrl}/product`;

  /** Líneas crudas `{ productId, quantity }`. Fuente de verdad del carrito guest. */
  private readonly _lines = signal<GuestCartLine[]>([]);
  /** Caché en memoria de productos públicos hidratados: id -> producto | null (no disponible). */
  private readonly _productCache = signal<Map<string, PublicProduct | null>>(new Map());
  /** Ids con una petición de hidratación en curso (evita peticiones duplicadas). */
  private readonly _inFlight = new Set<string>();

  /** Líneas crudas (solo lectura). */
  readonly lines = this._lines.asReadonly();

  /** Total de unidades — para el badge del header. */
  readonly count = computed(() => this._lines().reduce((sum, l) => sum + l.quantity, 0));

  /** Líneas con datos de producto para la UI (drawer / checkout). */
  readonly hydrated = computed<GuestCartHydratedLine[]>(() => {
    const cache = this._productCache();
    return this._lines().map((l) => {
      const cached = cache.has(l.productId) ? cache.get(l.productId)! : null;
      return {
        productId: l.productId,
        quantity: l.quantity,
        product: cached,
        unavailable: cache.has(l.productId) && cached === null,
      };
    });
  });

  readonly isEmpty = computed(() => this._lines().length === 0);

  constructor() {
    this._lines.set(this.readStorage());
  }

  // --- Mutaciones -------------------------------------------------------

  /** Añade `qty` unidades del producto (o crea la línea). Dedupe por productId. */
  add(productId: string, qty = 1): void {
    if (!OBJECT_ID_RE.test(productId)) return;
    const delta = clampQty(qty);
    this._lines.update((lines) => {
      const existing = lines.find((l) => l.productId === productId);
      if (existing) {
        return lines.map((l) =>
          l.productId === productId ? { ...l, quantity: clampQty(l.quantity + delta) } : l,
        );
      }
      return [...lines, { productId, quantity: delta }];
    });
    this.persist();
    this.refreshHydration();
  }

  /** +1 unidad. */
  increment(productId: string): void {
    this.setQuantity(productId, (this.quantityOf(productId) ?? 0) + 1);
  }

  /** -1 unidad; si llega a 0, elimina la línea (nunca se persiste quantity <= 0). */
  decrement(productId: string): void {
    const next = (this.quantityOf(productId) ?? 0) - 1;
    if (next < MIN_ORDER_ITEM_QTY) {
      this.remove(productId);
      return;
    }
    this.setQuantity(productId, next);
  }

  /** Fija la cantidad exacta (entero 1..50). <=0 elimina la línea. */
  setQuantity(productId: string, qty: number): void {
    if (!Number.isFinite(qty) || Math.trunc(qty) < MIN_ORDER_ITEM_QTY) {
      this.remove(productId);
      return;
    }
    const value = clampQty(qty);
    this._lines.update((lines) =>
      lines.map((l) => (l.productId === productId ? { ...l, quantity: value } : l)),
    );
    this.persist();
  }

  /** Elimina una línea. */
  remove(productId: string): void {
    this._lines.update((lines) => lines.filter((l) => l.productId !== productId));
    this.persist();
  }

  /** Vacía el carrito guest. SOLO se llama tras un 201 confirmado (UI-4B §19). */
  clear(): void {
    this._lines.set([]);
    this._productCache.set(new Map());
    if (!this.isBrowser) return;
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* almacenamiento inaccesible: el estado en memoria ya quedó vacío */
    }
  }

  // --- Hidratación pública de productos --------------------------------

  /**
   * Trae los datos públicos de los productos del carrito que aún no están en
   * caché (`GET /api/product/:id`). Best-effort: un producto que responde
   * 404/400 se marca como no disponible (`null` en caché) y la UI lo indica sin
   * eliminarlo en silencio.
   */
  refreshHydration(): void {
    if (!this.isBrowser) return;
    const cache = this._productCache();
    const missing = this._lines()
      .map((l) => l.productId)
      .filter((id) => !cache.has(id) && !this._inFlight.has(id));
    if (missing.length === 0) return;
    missing.forEach((id) => this._inFlight.add(id));

    const headers = new HttpHeaders({ 'content-type': 'application/json' });
    const requests = missing.map((id) =>
      this.http
        .get<{ msg: string; data: PublicProduct }>(`${this.PRODUCT_URL}/${id}`, { headers })
        .pipe(catchError(() => of(null))),
    );

    forkJoin(requests).subscribe((results) => {
      this._productCache.update((prev) => {
        const next = new Map(prev);
        missing.forEach((id, i) => {
          const res = results[i];
          next.set(id, res && res.data && res.data._id ? res.data : null);
        });
        return next;
      });
      missing.forEach((id) => this._inFlight.delete(id));
    });
  }

  // --- Helpers privados ------------------------------------------------

  private quantityOf(productId: string): number | undefined {
    return this._lines().find((l) => l.productId === productId)?.quantity;
  }

  private persist(): void {
    if (!this.isBrowser) return;
    try {
      const payload = { version: 1, items: this._lines() };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      /* cuota llena / almacenamiento bloqueado: el carrito sigue vivo en memoria */
    }
  }

  /**
   * Lee y SANEA el carrito guardado. Nunca lanza: cualquier problema devuelve
   * `[]`. Acepta tanto `{ version, items }` como un array plano (por si una
   * versión previa persistió distinto).
   */
  private readStorage(): GuestCartLine[] {
    if (!this.isBrowser) return [];
    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      return [];
    }
    if (!raw) return [];

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return [];
    }

    const rawItems: unknown = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === 'object'
        ? (parsed as { items?: unknown }).items
        : undefined;

    if (!Array.isArray(rawItems)) return [];

    const byId = new Map<string, number>();
    for (const entry of rawItems) {
      if (!entry || typeof entry !== 'object') continue;
      const productId = (entry as { productId?: unknown }).productId;
      const quantity = (entry as { quantity?: unknown }).quantity;
      if (typeof productId !== 'string' || !OBJECT_ID_RE.test(productId)) continue;
      if (typeof quantity !== 'number' || !Number.isFinite(quantity)) continue;
      const q = clampQty(quantity);
      byId.set(productId, clampQty((byId.get(productId) ?? 0) + q));
    }

    return [...byId.entries()].map(([productId, quantity]) => ({ productId, quantity }));
  }
}
