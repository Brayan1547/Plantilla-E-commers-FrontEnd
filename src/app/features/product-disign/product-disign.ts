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
import { ActivatedRoute, RouterLink } from '@angular/router';

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
 * F7-F — variantes: SOLO informativas (`color`/`size`/`stock` — el backend ni
 * siquiera manda `sku`, ver `PublicProductVariant`). NO hay selector
 * accionable: `addToCart()` sigue mandando únicamente `{productId, quantity}`
 * a `HttpCart`, exactamente igual que antes de F7. Conectar una variante
 * elegida al carrito requeriría un `variantId` en `CartItem` — fuera de
 * alcance de F7 por decisión explícita (ver F7.AUDIT §10 / deuda documentada
 * en el reporte de implementación).
 *
 * UI-3B — sólo evolución VISUAL / responsive / accesibilidad de esta misma
 * ficha (galería vertical + imagen principal + imágenes apiladas, breadcrumbs
 * propios, pills de talla de PRESENTACIÓN, bloque informativo de pago contra
 * entrega, acordeones nativos, visor accesible). Sin cambios de contrato: el
 * flujo de carga, `addToCart()`, `HttpCart`, `quantity` y los servicios
 * inyectados quedan intactos. El estado nuevo (`selectedUrl`, `zoomOpener`)
 * es únicamente de presentación.
 */
@Component({
  selector: 'app-product-disign',
  imports: [CommonModule, RouterLink],
  templateUrl: './product-disign.html',
  styleUrl: './product-disign.css',
})
export default class ProductDisign {
  private route = inject(ActivatedRoute);
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

  protected readonly quantity = signal(1);
  protected readonly adding = signal(false);

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
   * F7-F — variantes disponibles, SOLO informativas (color/talla/¿hay
   * stock?). `[]` en productos sin variantes (venta agregada, comportamiento
   * sin cambios). Nunca conectado a `addToCart()`.
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
   * UI-3B — tallas como "pills" de PRESENTACIÓN. Una entrada por talla
   * distinta (valor tal cual `variant.size`; "Única" se muestra "Única").
   * `available` es true si ALGUNA variante de esa talla tiene stock. NO hay
   * estado "seleccionada": elegir una talla NO cambia lo que envía el carrito
   * — el contrato `CartItem = {productId, quantity}` queda intacto.
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

  constructor() {
    // Visor de imagen: mientras está abierto se bloquea el scroll del body y se
    // lleva el foco al botón de cierre. Reversible; también se limpia en
    // ngOnDestroy. No usa ningún servicio global de modal.
    effect(() => {
      const open = this.zoomImage() !== null;
      if (!this.isBrowser) return;
      document.body.style.overflow = open ? 'hidden' : '';
      if (open) {
        queueMicrotask(() => this.closeBtn()?.nativeElement.focus());
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
    this.closeZoom();
  }

  protected increaseQty(): void {
    this.quantity.update((q) => q + 1);
  }

  protected decreaseQty(): void {
    this.quantity.update((q) => (q > 1 ? q - 1 : 1));
  }

  protected addToCart(): void {
    const p = this.product();
    if (!p || this.outOfStock() || this.adding()) return;

    // UI-4B — invitado: carrito local. NO se abre el modal de login: la compra
    // como invitado es un flujo de primera clase. El contrato del carrito sigue
    // siendo `{productId, quantity}` (sin variantId).
    if (!this.auth.user) {
      this.guestCart.add(p._id, this.quantity());
      this.toast.show('Producto agregado al carrito');
      return;
    }

    this.adding.set(true);
    this.httpCart.updateCart(p._id, this.quantity()).subscribe({
      next: () => {
        this.toast.show('Producto agregado al carrito');
        this.adding.set(false);
      },
      error: () => {
        this.toast.show('No se pudo agregar al carrito', 'error');
        this.adding.set(false);
      },
    });
  }
}
