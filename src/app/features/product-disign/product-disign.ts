import {
  Component,
  computed,
  effect,
  ElementRef,
  HostListener,
  inject,
  PLATFORM_ID,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { HttpProduct } from '../../core/services/http-product';
import { HttpCart } from '../../core/services/http-cart';
import { GuestCart } from '../../core/services/guest-cart';
import { HttpAuth } from '../../core/services/http-auth';
import { UiModal } from '../../core/services/ui-modal';
import { Toast } from '../../core/services/toast';
import type { PublicProduct, PublicProductVariant } from '../../core/models/public-product.model';

type DetailState = 'loading' | 'ready' | 'not-found' | 'error';

/** Imagen lista para renderizar: URL + `alt` ya resuelto (image.alt o nombre del producto). */
interface GalleryImage {
  url: string;
  alt: string;
}

/**
 * Ficha pública de producto — ruta `tienda/producto/:id` (SSR).
 *
 * Carga el producto REAL con `HttpProduct.getProductById(:id)` ->
 * `GET /api/product/:id`. Product Domain: el backend YA aplica la regla de
 * publicación aquí mismo (Regla §25) — un producto que no esté
 * `status:PUBLISHED` + `isActive:true` responde 404, así que "no encontrado"
 * cubre tanto "no existe" como "no está publicado", sin filtrar más en Angular.
 *
 * F7-E — renderiza el contrato público AMPLIADO: `details`, `shippingInfo`,
 * `returnsInfo`, `modelInfo`, `categories` (poblado a `{name,slug}`), además
 * de lo que ya mostraba (name/price/description/images/stock agregado).
 *
 * F7-F / TALLAS — variantes públicas: `color`/`size`/`stock` (el backend no
 * manda `sku`, ver `PublicProductVariant`). La talla SÍ es un selector
 * accionable: si el producto tiene variantes, elegir una talla es obligatorio
 * y `addToCart()` envía `{productId, quantity, size}`. Un producto simple
 * (variants: []) sigue enviando `{productId, quantity}`. NO se usa `variantId`:
 * `size` es el mismo texto de `variant.size`. El backend es la autoridad final
 * de stock y validación de la talla.
 *
 * UI-3B — la ficha mantiene su diseño (galería vertical, breadcrumbs propios,
 * bloque informativo de pago contra entrega, acordeones nativos, visor
 * accesible). El estado de presentación (`selectedUrl`, `zoomOpener`) no toca
 * el carrito; el estado de compra (`selectedSize`, `quantity`) sí.
 */
@Component({
  selector: 'app-product-disign',
  imports: [CommonModule, RouterLink],
  templateUrl: './product-disign.html',
  styleUrl: './product-disign.css',
})
export default class ProductDisign {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private httpProduct = inject(HttpProduct);
  private httpCart = inject(HttpCart);
  private guestCart = inject(GuestCart);
  private auth = inject(HttpAuth);
  private uiModal = inject(UiModal);
  private toast = inject(Toast);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly state = signal<DetailState>('loading');
  protected readonly product = signal<PublicProduct | null>(null);

  /** Imagen ampliada en el visor modal (null = cerrado). */
  protected readonly zoomImage = signal<string | null>(null);
  /** Elemento que abrió el visor — se le devuelve el foco al cerrar. */
  private zoomOpener: HTMLElement | null = null;
  private readonly closeBtn = viewChild<ElementRef<HTMLButtonElement>>('closeBtn');

  /**
   * AJUSTE UX — modal de compra. Se abre SOLO cuando "Añadir al carrito"
   * termina con éxito (nunca si falla una validación o la petición). No usa
   * `UiModal` (ese servicio es exclusivo del modal de auth); vive en el
   * componente igual que el visor de imagen.
   */
  protected readonly buyModalOpen = signal(false);
  private readonly buyModalBtn = viewChild<ElementRef<HTMLButtonElement>>('buyModalBtn');

  protected readonly quantity = signal(1);
  protected readonly adding = signal(false);

  /**
   * TALLAS — talla elegida por el usuario (`null` = ninguna). Solo aplica a
   * productos con variantes. NO es un `variantId`: es el valor de texto de
   * `product.variants[].size` (S/M/L/XL/"Única"/…), el mismo que exige el backend.
   */
  protected readonly selectedSize = signal<string | null>(null);
  /** Se enciende tras intentar "Añadir" sin talla, para mostrar el aviso inline. */
  protected readonly showSizeHint = signal(false);

  /** URL de la miniatura elegida (null = primera imagen de la galería). SOLO presentación. */
  private readonly selectedUrl = signal<string | null>(null);

  /**
   * Imágenes reales del producto, ordenadas (principal primero, luego `order`),
   * con `alt` resuelto: `image.alt` real y, si viene vacío, el nombre del
   * producto como respaldo. Usa el contrato existente — sin requests extra.
   */
  protected readonly gallery = computed<GalleryImage[]>(() => {
    const p = this.product();
    const name = p?.name?.trim() || 'producto';
    const imgs = (p?.images ?? []).filter((i) => !!i?.url);
    const sorted = [...imgs].sort((a, b) => {
      if (!!a.isMain !== !!b.isMain) return a.isMain ? -1 : 1;
      return (a.order ?? 0) - (b.order ?? 0);
    });
    return sorted.map((i) => ({ url: i.url, alt: i.alt?.trim() || name }));
  });

  /** Imagen mostrada en grande: la seleccionada, o la primera de la galería. */
  protected readonly currentImage = computed<GalleryImage | null>(() => {
    const list = this.gallery();
    if (!list.length) return null;
    const sel = this.selectedUrl();
    return list.find((i) => i.url === sel) ?? list[0];
  });

  /** Resto de imágenes, apiladas verticalmente bajo la principal. */
  protected readonly secondaryImages = computed<GalleryImage[]>(() => {
    const current = this.currentImage()?.url;
    return this.gallery().filter((i) => i.url !== current);
  });

  protected readonly outOfStock = computed(() => (this.product()?.stock ?? 0) <= 0);

  /** F7-E — nombres de categoría (ya poblados por el backend: `{_id,name,slug}`). */
  protected readonly categoryNames = computed<string[]>(() =>
    (this.product()?.categories ?? []).map((c) => c.name).filter(Boolean),
  );

  /** Primera categoría poblada — la usa sólo el breadcrumb (degrada limpio si no hay). */
  protected readonly primaryCategory = computed(() => this.product()?.categories?.[0] ?? null);

  /**
   * F7-E — `modelInfo` en una sola línea legible. `heightCm` es SIEMPRE
   * numérico en centímetros en el backend (sin cambios de F7); aquí se
   * presenta como "187 cm" — no se convierte a metros ni se toca el modelo.
   * `null` si no hay ningún dato de modelo que mostrar.
   */
  protected readonly modelInfoLabel = computed<string | null>(() => {
    const m = this.product()?.modelInfo;
    if (!m || (!m.size && !m.heightCm)) return null;
    const parts: string[] = [];
    if (m.size) parts.push(`talla ${m.size}`);
    if (m.heightCm) parts.push(`${m.heightCm} cm de estatura`);
    return `Modelo: ${parts.join(', ')}`;
  });

  /**
   * Variantes del producto (color/talla/stock). `[]` en productos sin variantes
   * (venta por stock agregado, sin talla). Cuando hay variantes, alimentan el
   * selector de talla y la validación de `addToCart()`.
   */
  protected readonly variants = computed<PublicProductVariant[]>(() => this.product()?.variants ?? []);
  protected readonly hasVariants = computed(() => this.variants().length > 0);

  /** Colores distintos presentes en las variantes (texto informativo). */
  protected readonly variantColors = computed<string[]>(() => {
    const seen = new Set<string>();
    for (const v of this.variants()) {
      const c = v.color?.trim();
      if (c) seen.add(c);
    }
    return [...seen];
  });

  /**
   * TALLAS — opciones del selector, una por talla distinta (valor tal cual
   * `variant.size`; "Única" se muestra "Única"). `available` es true si ALGUNA
   * variante de esa talla tiene stock. La talla elegida (`selectedSize`) viaja
   * al carrito como `{productId, quantity, size}`; la identidad de una línea del
   * carrito es (productId + size).
   */
  protected readonly sizeOptions = computed<{ size: string; available: boolean }[]>(() => {
    const map = new Map<string, boolean>();
    for (const v of this.variants()) {
      const s = v.size?.trim();
      if (!s) continue;
      map.set(s, (map.get(s) ?? false) || (v.stock ?? 0) > 0);
    }
    return [...map].map(([size, available]) => ({ size, available }));
  });

  /**
   * TALLAS — máximo de unidades que la UI permite pedir:
   *   · producto CON variantes  -> stock de la talla seleccionada (suma de las
   *     variantes de esa talla; 0 si aún no hay talla elegida). El backend sigue
   *     siendo la autoridad real (§8).
   *   · producto SIMPLE         -> `Infinity` (sin cambios: no había tope en la
   *     UI y el backend valida al agregar).
   */
  protected readonly maxQty = computed<number>(() => {
    if (!this.hasVariants()) return Number.POSITIVE_INFINITY;
    const s = this.selectedSize();
    if (!s) return 0;
    return this.variants()
      .filter((v) => (v.size ?? '').trim() === s)
      .reduce((sum, v) => sum + (v.stock ?? 0), 0);
  });

  /** Producto con tallas y sin talla elegida todavía: aún no se puede agregar. */
  protected readonly needsSizeChoice = computed(() => this.hasVariants() && this.selectedSize() === null);

  /** TALLAS — elige una talla. Ignora las agotadas; ajusta la cantidad al nuevo tope. */
  protected selectSize(size: string): void {
    const opt = this.sizeOptions().find((o) => o.size === size);
    if (!opt || !opt.available) return; // una talla agotada no se puede seleccionar
    this.selectedSize.set(size);
    this.showSizeHint.set(false);
    const max = this.maxQty();
    if (this.quantity() > max) this.quantity.set(Math.max(1, max));
  }

  constructor() {
    // Visor de imagen: mientras está abierto se bloquea el scroll del body y se
    // lleva el foco al botón de cierre. Reversible; también se limpia en
    // ngOnDestroy. No usa ningún servicio global de modal.
    effect(() => {
      const zoomOpen = this.zoomImage() !== null;
      const buyOpen = this.buyModalOpen();
      if (!this.isBrowser) return;
      document.body.style.overflow = zoomOpen || buyOpen ? 'hidden' : '';
      if (zoomOpen) {
        queueMicrotask(() => this.closeBtn()?.nativeElement.focus());
      } else if (buyOpen) {
        queueMicrotask(() => this.buyModalBtn()?.nativeElement.focus());
      }
    });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');

    // Guarda barata contra ids con forma no-ObjectId antes de gastar una request.
    if (!id || !/^[a-f\d]{24}$/i.test(id)) {
      this.state.set('not-found');
      return;
    }

    this.httpProduct.getProductById(id).subscribe({
      next: (res) => {
        const data = res?.data;
        if (!data || !data._id) {
          this.state.set('not-found');
          return;
        }
        this.product.set(data);
        this.state.set('ready');
        // TALLAS — si el producto tiene UNA sola talla disponible (p. ej. un
        // accesorio "Única"), se preselecciona para ahorrar un clic. Con varias
        // tallas NO se preselecciona ninguna (§4: "Sin selección").
        const opts = this.sizeOptions();
        if (opts.length === 1 && opts[0].available) this.selectedSize.set(opts[0].size);
      },
      error: (err) => {
        // El backend responde 400 (id inválido) y 404 (no existe) -> "not-found".
        this.state.set(err?.status === 404 || err?.status === 400 ? 'not-found' : 'error');
      },
    });
  }

  ngOnDestroy(): void {
    if (this.isBrowser) document.body.style.overflow = '';
  }

  /** UI-3B — cambia la imagen principal. Sólo presentación (no toca Product/Variant/Cart). */
  protected selectImage(url: string): void {
    this.selectedUrl.set(url);
  }

  protected openZoom(url: string, ev?: Event): void {
    this.zoomOpener = (ev?.currentTarget as HTMLElement) ?? null;
    this.zoomImage.set(url);
  }

  protected closeZoom(): void {
    if (this.zoomImage() === null) return;
    this.zoomImage.set(null);
    const opener = this.zoomOpener;
    this.zoomOpener = null;
    if (this.isBrowser && opener) {
      queueMicrotask(() => opener.focus());
    }
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.buyModalOpen()) {
      this.closeBuyModal();
      return;
    }
    this.closeZoom();
  }

  protected increaseQty(): void {
    // TALLAS — nunca por encima del stock de la talla elegida. Producto simple:
    // `maxQty()` es Infinity -> comportamiento sin cambios.
    this.quantity.update((q) => (q < this.maxQty() ? q + 1 : q));
  }

  protected decreaseQty(): void {
    this.quantity.update((q) => (q > 1 ? q - 1 : 1));
  }

  /**
   * "Añadir al carrito" — comportamiento existente SIN cambios (validación de
   * talla, invitado vs. autenticado, servicio de carrito, toasts). ÚNICO
   * añadido: al terminar con éxito se abre el modal de compra.
   */
  protected addToCart(): void {
    this.addToCartInternal(() => this.buyModalOpen.set(true));
  }

  /**
   * "Comprar ahora" — MISMAS validaciones y MISMO servicio de carrito que
   * "Añadir al carrito"; al terminar con éxito lleva directo al formulario de
   * compra. El checkout lee la línea recién agregada del carrito (invitado o
   * backend), así que talla y cantidad se conservan sin estado ni ruta paralela.
   */
  protected buyNow(): void {
    this.addToCartInternal(() => this.router.navigateByUrl('/checkout'));
  }

  /** Modal de compra -> continuar al formulario. */
  protected goToCheckout(): void {
    this.buyModalOpen.set(false);
    this.router.navigateByUrl('/checkout');
  }

  protected closeBuyModal(): void {
    this.buyModalOpen.set(false);
  }

  /**
   * Lógica compartida de "añadir al carrito". `onSuccess` se ejecuta SOLO en el
   * camino exitoso (carrito de invitado actualizado, o 2xx del backend); nunca
   * si una validación corta el flujo ni si la petición falla.
   */
  private addToCartInternal(onSuccess: () => void): void {
    const p = this.product();
    if (!p || this.outOfStock() || this.adding()) return;

    // TALLAS — producto con variantes: la talla es OBLIGATORIA (igual que exige
    // el backend). Sin talla elegida -> aviso UX y se corta (no `alert()`).
    const size = this.selectedSize() ?? undefined;
    if (this.hasVariants() && !size) {
      this.showSizeHint.set(true);
      this.toast.show('Selecciona una talla', 'error');
      return;
    }

    // UI-4B — invitado: carrito local. NO se abre el modal de login: la compra
    // como invitado es un flujo de primera clase. Payload: `{productId, quantity}`
    // para productos simples; `{productId, quantity, size}` con talla. Nunca
    // `variantId`/`color`/`sku`.
    if (!this.auth.user) {
      this.guestCart.add(p._id, this.quantity(), size);
      this.toast.show('Producto agregado al carrito');
      onSuccess();
      return;
    }

    this.adding.set(true);
    this.httpCart.updateCart(p._id, this.quantity(), size).subscribe({
      next: () => {
        this.toast.show('Producto agregado al carrito');
        this.adding.set(false);
        onSuccess();
      },
      error: (err) => {
        // §8 — el backend es la autoridad: talla inexistente / ambigua / sin
        // stock / producto cambiado. Se muestra su mensaje si lo trae.
        this.toast.show(this.cartErrorMessage(err), 'error');
        this.adding.set(false);
      },
    });
  }

  /** Mensaje del backend (`{ msg }`) si lo hay; si no, uno genérico. */
  private cartErrorMessage(err: unknown): string {
    const msg = (err as { error?: { msg?: unknown } })?.error?.msg;
    return typeof msg === 'string' && msg.trim() ? msg : 'No se pudo agregar al carrito';
  }
}
