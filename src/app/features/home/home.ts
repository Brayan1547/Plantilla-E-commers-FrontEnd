import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule,  } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpProduct } from '../../core/services/http-product';
import { HttpCart } from '../../core/services/http-cart';
import { HttpCategory } from '../../core/services/http-category';

import { GuestCart } from '../../core/services/guest-cart'; // UI-4B: carrito de invitado (sin login)
import { Toast } from '../../core/services/toast'; // feedback al agregar al carrito
import { HttpAuth } from '../../core/services/http-auth'; // nuevo: saber si hay usuario logueado
import type { PublicCategory, PublicProduct, PublicProductImage } from '../../core/models/public-product.model';

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
  private httpCategory = inject(HttpCategory);
  private httpCart = inject(HttpCart); //  para agregar productos al carrito

  private guestCart = inject(GuestCart);
  private toast = inject(Toast);
  httpAuth = inject(HttpAuth); // público: el html necesita leer el rol directo

  protected readonly state = signal<HomeState>('loading');

  // Categorías ACTIVAS desde el backend (el contrato público ya excluye las inactivas).
  protected readonly categories = signal<PublicCategory[]>([]);

  // Prioridad: imagen subida desde el admin > imagen local por slug (las 3 originales) > respaldo.
  private readonly CATEGORY_IMAGES: Record<string, string> = {
    rostro: '/assets/imagenes/rostro.jpeg',
    labios: '/assets/imagenes/labios.jpeg',
    'ojos-y-cejas': '/assets/imagenes/ojos-cejas.jpeg',
  };
  private readonly CATEGORY_FALLBACK_IMAGE = '/assets/imagenes/fondo-v.png';

  //  protected categoryImage(c: PublicCategory): string {
  //   const url = c.image?.url;
  //   if (url) {
  //     // Cloudinary: recorta a 3:4 enfocando lo importante (g_auto) y optimiza el peso.
  //     return url.includes('/upload/')
  //       ? url.replace('/upload/', '/upload/c_fill,ar_3:4,g_auto,w_900,f_auto,q_auto/')
  //       : url;
  //   }
  //   return this.CATEGORY_IMAGES[c.slug] ?? this.CATEGORY_FALLBACK_IMAGE;
  // }

    protected categoryImage(c: PublicCategory): string {
    const url = c.image?.url;
    if (url) {
      return url.includes('/upload/')
        ? url.replace('/upload/', '/upload/w_900,f_auto,q_auto/')
        : url;
    }
    return this.CATEGORY_IMAGES[c.slug] ?? this.CATEGORY_FALLBACK_IMAGE;
  }

  // F7-D — CATÁLOGO GENERAL: todos los productos públicos+activos que
  // devolvió el backend, SIN ordenar ni recortar.
  private products = signal<PublicProduct[]>([]);

  /** "Recién llegados": los `NEW_ARRIVALS_LIMIT` productos con `publishedAt` más reciente. */
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
    this.httpCategory.getCategory().subscribe({
      next: (res) => this.categories.set((res?.data ?? []).filter((c) => c.isActive)),
      error: (err) => console.error(err),
    });
    this.state.set('loading');
    this.httpProduct.getProduct().subscribe({
      next: (res) => {
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

  /** F7-D — "Nuevo" solo si de verdad se publicó dentro de la ventana real. */
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

  // images es un arreglo [{url, isMain}]. Usa la principal; si no hay, la primera.
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