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
 *  - Cada línea es `{ productId: string, quantity: number, size?: string }`.
 *    `size` es OPCIONAL: solo lo llevan los productos con variantes (es el
 *    texto de `variant.size`, nunca un `variantId`). La identidad de una línea
 *    es (productId + size): dos tallas del mismo producto son dos líneas.
 *    Sin `Product.stock`, sin `stockOps`, sin más campos. El backend sigue
 *    siendo la autoridad de stock y de la validez de la talla.
 *  - En `localStorage` se persiste ÚNICAMENTE eso (`{ productId, quantity }` o
 *    `{ productId, quantity, size }`). NUNCA precio, nombre, imagen, stock,
 *    producto completo, usuario, PII, token, order ni pago.
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

/**
 * Línea cruda persistida (lo único que va a `localStorage`).
 * `size` OPCIONAL: solo productos con variantes lo llevan. La identidad de una
 * línea es (productId + size): dos tallas del mismo producto son dos líneas y
 * NO se fusionan. Las líneas antiguas del `v1` (sin `size`) siguen siendo
 * válidas — se interpretan como producto simple (`size` ausente).
 */
export interface GuestCartLine {
  productId: string;
  quantity: number;
  size?: string;
}

/** Línea con datos públicos de producto hidratados para la UI (solo memoria). */
export interface GuestCartHydratedLine {
  productId: string;
  quantity: number;
  size?: string;
  /** Producto público, o `null` si aún no se ha hidratado / no se pudo. */
  product: PublicProduct | null;
  /** true si el backend indicó que el producto ya no está disponible (404/400). */
  unavailable: boolean;
}

// Mismo `v1`: NO se versiona la clave. El formato es backward-compatible —
// solo se AÑADE un campo opcional `size`. Los items sin `size` (todo el
// contenido `v1` existente en navegadores reales) se leen igual que siempre.
const STORAGE_KEY = 'dusck.guestCart.v1';
const OBJECT_ID_RE = /^[a-f\d]{24}$/i;
const MAX_SIZE_LEN = 20; // = maxlength de `CartItemSchema.size` en el backend

/** Talla saneada: string no vacío ≤20 chars tras trim, o `undefined`. */
const cleanSize = (s: unknown): string | undefined => {
  if (typeof s !== 'string') return undefined;
  const t = s.trim();
  return t.length > 0 && t.length <= MAX_SIZE_LEN ? t : undefined;
};

/** Clave de identidad de línea: productId + talla (o su ausencia). */
const lineKey = (productId: string, size?: string): string => `${productId}::${size ?? ''}`;

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
        ...(l.size ? { size: l.size } : {}),
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

  /**
   * Añade `qty` unidades de una línea (o la crea). Identidad = productId + size:
   * dos tallas del mismo producto son líneas distintas y NO se fusionan.
   * `size` OPCIONAL — un producto simple lo omite y la línea persiste como
   * `{ productId, quantity }`, idéntico a antes.
   */
  add(productId: string, qty = 1, size?: string): void {
    if (!OBJECT_ID_RE.test(productId)) return;
    const s = cleanSize(size);
    const delta = clampQty(qty);
    this._lines.update((lines) => {
      const existing = lines.find((l) => l.productId === productId && (l.size ?? '') === (s ?? ''));
      if (existing) {
        return lines.map((l) =>
          l === existing ? { ...l, quantity: clampQty(l.quantity + delta) } : l,
        );
      }
      return [...lines, { productId, quantity: delta, ...(s ? { size: s } : {}) }];
    });
    this.persist();
    this.refreshHydration();
  }

  /** +1 unidad de la línea (productId + size). */
  increment(productId: string, size?: string): void {
    this.setQuantity(productId, (this.quantityOf(productId, size) ?? 0) + 1, size);
  }

  /** -1 unidad; si llega a 0, elimina esa línea (nunca se persiste quantity <= 0). */
  decrement(productId: string, size?: string): void {
    const next = (this.quantityOf(productId, size) ?? 0) - 1;
    if (next < MIN_ORDER_ITEM_QTY) {
      this.remove(productId, size);
      return;
    }
    this.setQuantity(productId, next, size);
  }

  /** Fija la cantidad exacta (entero 1..50) de la línea (productId + size). <=0 la elimina. */
  setQuantity(productId: string, qty: number, size?: string): void {
    if (!Number.isFinite(qty) || Math.trunc(qty) < MIN_ORDER_ITEM_QTY) {
      this.remove(productId, size);
      return;
    }
    const s = size === undefined ? undefined : cleanSize(size);
    const value = clampQty(qty);
    this._lines.update((lines) =>
      lines.map((l) =>
        l.productId === productId && (l.size ?? '') === (s ?? '') ? { ...l, quantity: value } : l,
      ),
    );
    this.persist();
  }

  /** Elimina una línea (productId + size). */
  remove(productId: string, size?: string): void {
    const s = size === undefined ? undefined : cleanSize(size);
    this._lines.update((lines) =>
      lines.filter((l) => !(l.productId === productId && (l.size ?? '') === (s ?? ''))),
    );
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
    // Dedupe por productId: dos líneas del mismo producto en tallas distintas
    // comparten los MISMOS datos públicos -> una sola petición de hidratación.
    const missing = [...new Set(this._lines().map((l) => l.productId))]
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

  private quantityOf(productId: string, size?: string): number | undefined {
    const s = size === undefined ? undefined : cleanSize(size);
    return this._lines().find((l) => l.productId === productId && (l.size ?? '') === (s ?? ''))?.quantity;
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

    // Dedupe por (productId + size): dos entradas con la misma talla se suman;
    // tallas distintas del mismo producto se conservan como líneas separadas.
    const byKey = new Map<string, GuestCartLine>();
    for (const entry of rawItems) {
      if (!entry || typeof entry !== 'object') continue;
      const productId = (entry as { productId?: unknown }).productId;
      const quantity = (entry as { quantity?: unknown }).quantity;
      if (typeof productId !== 'string' || !OBJECT_ID_RE.test(productId)) continue;
      if (typeof quantity !== 'number' || !Number.isFinite(quantity)) continue;
      // `size` OPCIONAL — una entrada `v1` antigua sin este campo se lee igual.
      const size = cleanSize((entry as { size?: unknown }).size);
      const key = lineKey(productId, size);
      const q = clampQty(quantity);
      const prev = byKey.get(key);
      byKey.set(key, {
        productId,
        quantity: clampQty((prev?.quantity ?? 0) + q),
        ...(size ? { size } : {}),
      });
    }

    return [...byKey.values()];
  }
}
