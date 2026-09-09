import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule,  } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpProduct } from '../../core/services/http-product';
import { HttpCart } from '../../core/services/http-cart';

import { GuestCart } from '../../core/services/guest-cart'; // UI-4B: carrito de invitado (sin login)
import { Toast } from '../../core/services/toast'; // feedback al agregar al carrito
import { HttpAuth } from '../../core/services/http-auth'; // nuevo: saber si hay usuario logueado
import type { PublicProduct, PublicProductImage } from '../../core/models/public-product.model';

/** F7-D — ventana de "recién llegado": publicado dentro de los últimos N días. */
const NEW_ARRIVAL_WINDOW_DAYS = 30;
/** F7-D — cupo de la grilla de "Recién llegados" (2 filas x 4 columnas en desktop, ver home.css `.product-grid`). */
const NEW_ARRIVALS_LIMIT = 8;

type HomeState = 'loading' | 'ready' | 'empty' | 'error';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {

  // (0) Siempre inyectar la dependencia
  private httpProduct = inject(HttpProduct);
  private httpCart = inject(HttpCart); //  para agregar productos al carrito

  private guestCart = inject(GuestCart);
  private toast = inject(Toast);
  httpAuth = inject(HttpAuth); // público: el html necesita leer el rol directo

  protected readonly state = signal<HomeState>('loading');

  // F7-D — CATÁLOGO GENERAL: todos los productos públicos+activos que
  // devolvió el backend, SIN ordenar ni recortar. Se mantiene separado de
  // `newArrivals` (abajo) a propósito — ver F7.AUDIT §6: "Recién llegados"
  // NO debe alterar el orden/alcance del catálogo general, y viceversa.
  private products = signal<PublicProduct[]>([]);

  /**
   * "Recién llegados": los `NEW_ARRIVALS_LIMIT` productos con `publishedAt`
   * más reciente (nunca `createdAt`/`updatedAt` — un DRAFT editado meses
   * después de creado, o un producto reabierto y vuelto a publicar, no debe
   * "saltar" a recién llegado por eso; `publishedAt` es la única fecha con
   * ese significado real, ver `updateProductStatus` en el backend).
   */
  protected readonly newArrivals = computed<PublicProduct[]>(() =>
    [...this.products()]
      .filter((p) => !!p.publishedAt)
      .sort((a, b) => new Date(b.publishedAt!).getTime() - new Date(a.publishedAt!).getTime())
      .slice(0, NEW_ARRIVALS_LIMIT),
  );

  ngOnInit() {
    this.onLoadData();
  }

  onLoadData(){
    this.state.set('loading');
    this.httpProduct.getProduct().subscribe({
      next: (res) => {
        // Product Domain: GET /api/product publico YA filtra en el BACKEND a
        // status:PUBLISHED + isActive:true (Regla §24 — el backend es la
        // barrera real). Este filtro queda como defensa adicional, no como
        // el unico mecanismo de visibilidad.
        const list = (res?.data ?? []).filter((p) => p.isActive);
        this.products.set(list);
        this.state.set(list.length ? 'ready' : 'empty');
      },
      error: (err) => {
        console.error(err);
        this.state.set('error');
      },
    });
  }

  /** F7-D — "Nuevo" solo si de verdad se publicó dentro de la ventana real; ya no es incondicional. */
  protected isNew(product: PublicProduct): boolean {
    if (!product.publishedAt) return false;
    const ageDays = (Date.now() - new Date(product.publishedAt).getTime()) / 86_400_000;
    return ageDays >= 0 && ageDays <= NEW_ARRIVAL_WINDOW_DAYS;
  }

  onWishlist(event: Event, productId: string) {
    event.preventDefault();  // evita que el clic en el corazón dispare el routerLink de la card
    event.stopPropagation();

    console.log('Agregado a favoritos:', productId);
    // Aquí luego conectas tu servicio real, ej:
    // this.wishlistService.toggle(productId).subscribe(...)
  }

  // Agrega 1 unidad del producto al carrito al hacer click en "Comprar" de la card
  onAddToCart(event: Event, productId: string) {
    event.preventDefault();   // evita que el clic dispare el routerLink de la card
    event.stopPropagation();

    // UI-4B — invitado: carrito local (GuestCart), NUNCA se fuerza login. Es el
    // mismo flujo de primera clase que la ficha de producto
    // (`product-disign.ts#addToCart`), el drawer y el checkout. El contrato del
    // carrito sigue siendo `{ productId, quantity }`.
    if (!this.httpAuth.user) {
      this.guestCart.add(productId, 1);
      this.toast.show('Producto agregado al carrito');
      return;
    }

    this.httpCart.updateCart(productId, 1).subscribe({
      next: () => this.toast.show('Producto agregado al carrito'),
      error: () => this.toast.show('No se pudo agregar al carrito', 'error'),
    });
  }


  // IMPORTANTE: images ahora es un arreglo [{url, isMain}] (tu nuevo schema).
  // Esta función busca la que tiene isMain: true; si ninguna la tiene, usa la primera.
  getMainImage(images: PublicProductImage[]): string {
    if (!images || images.length === 0) return'';
    const main = images.find(img => img.isMain);
    return main ? main.url : images[0].url;
  }

  // Dice si el producto ya tiene al menos 1 imagen cargada
  hasImages(images: PublicProductImage[]): boolean {
    return !!images && images.length > 0;
  }

    // true solo si el usuario logueado puede administrar productos (mismos roles que el backend)
  get canManageProducts(): boolean {
    const role = this.httpAuth.user?.role;
    return role === 'administrador' || role === 'shop_manager';
  }

}
