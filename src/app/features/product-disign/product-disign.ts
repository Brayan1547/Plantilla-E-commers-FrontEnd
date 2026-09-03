import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { HttpProduct } from '../../core/services/http-product';
import { HttpCart } from '../../core/services/http-cart';
import { HttpAuth } from '../../core/services/http-auth';
import { UiModal } from '../../core/services/ui-modal';
import { Toast } from '../../core/services/toast';

type DetailState = 'loading' | 'ready' | 'not-found' | 'error';

/**
 * Ficha pública de producto — ruta `tienda/producto/:id` (SSR).
 *
 * Carga el producto REAL con `HttpProduct.getProductById(:id)` ->
 * `GET /api/product/:id`. Product Domain: el backend YA aplica la regla de
 * publicación aquí mismo (Regla §25) — un producto que no esté
 * `status:PUBLISHED` + `isActive:true` responde 404, así que "no encontrado"
 * cubre tanto "no existe" como "no está publicado", sin filtrar más en Angular.
 *
 * Renderiza los campos reales del modelo: name, price, description,
 * images[{url,isMain}], stock. El modelo ya soporta `categories[]` y
 * `variants[]` (color/talla/SKU/stock por variante), pero esta ficha compra
 * el producto de forma AGREGADA (sin selector de variante todavía) — el
 * carrito (`HttpCart`) tampoco distingue variantes hoy; es deuda conocida
 * hacia la futura fase de Orders, no algo que se resuelva aquí.
 *
 * Estados: loading · ready · not-found (data vacía / 404 / id inválido) · error.
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
  private auth = inject(HttpAuth);
  private uiModal = inject(UiModal);
  private toast = inject(Toast);

  protected readonly state = signal<DetailState>('loading');
  protected readonly product = signal<any | null>(null);

  /** Imagen ampliada en el visor modal (null = cerrado). */
  protected readonly zoomImage = signal<string | null>(null);

  protected readonly quantity = signal(1);
  protected readonly adding = signal(false);

  /** URLs de imágenes reales del producto; [] si no tiene. */
  protected readonly images = computed<string[]>(() => {
    const imgs = this.product()?.images ?? [];
    return imgs.map((i: any) => i?.url).filter((u: any): u is string => !!u);
  });

  /** Imagen principal (isMain) o la primera. */
  protected readonly mainImage = computed<string | null>(() => {
    const imgs = this.product()?.images ?? [];
    const main = imgs.find((i: any) => i?.isMain);
    return main?.url ?? imgs[0]?.url ?? null;
  });

  protected readonly outOfStock = computed(() => (this.product()?.stock ?? 0) <= 0);

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

  protected openZoom(url: string): void {
    this.zoomImage.set(url);
  }

  protected closeZoom(): void {
    this.zoomImage.set(null);
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

    if (!this.auth.user) {
      this.uiModal.open('login');
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
