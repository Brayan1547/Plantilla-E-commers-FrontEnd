import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { HttpProduct } from '../../core/services/http-product';
import { HttpCategory } from '../../core/services/http-category';

/**
 * BÁSICOS — sección pública permanente del storefront.
 *
 * Representa las prendas esenciales de DUSCK. La clasificación se hace mediante
 * la CATEGORÍA del producto (único mecanismo real disponible en el backend
 * actual: `product.category` -> `GET /api/category`). No existe un dominio
 * "básico vs colección" persistido; ver el informe R2.1 (§14) para la
 * limitación documentada.
 *
 * Datos: `GET /api/product` (público) + `GET /api/category` (público). Solo se
 * muestran productos y categorías con `isActive: true`. Sin UI administrativa.
 * El detalle usa la ruta pública existente `tienda/producto/:id`.
 */
@Component({
  selector: 'app-basicos',
  imports: [CommonModule, RouterLink],
  templateUrl: './basicos.html',
  styleUrl: './basicos.css',
})
export default class Basicos {
  private httpProduct = inject(HttpProduct);
  private httpCategory = inject(HttpCategory);
  private route = inject(ActivatedRoute);

  /** Categorías activas del catálogo. */
  protected readonly categories = signal<any[]>([]);
  /** Productos activos del catálogo. */
  protected readonly products = signal<any[]>([]);

  /** _id de la categoría seleccionada; null = "Todo". */
  protected readonly selectedCategoryId = signal<string | null>(null);

  /** slug de `?categoria=` que no corresponde a ninguna categoría activa. */
  protected readonly unknownCategory = signal<string | null>(null);

  protected readonly loading = signal(true);
  protected readonly error = signal(false);

  /** Productos activos que pertenecen a la categoría seleccionada (o todos). */
  protected readonly visibleProducts = computed(() => {
    if (this.unknownCategory()) return [];
    const catId = this.selectedCategoryId();
    const list = this.products();
    if (!catId) return list;
    return list.filter((p) => this.categoryIdOf(p) === catId);
  });

  ngOnInit(): void {
    const pending = { products: false, categories: false };
    const done = (key: 'products' | 'categories') => {
      pending[key] = true;
      if (pending.products && pending.categories) this.loading.set(false);
    };

    this.httpCategory.getCategory().subscribe({
      next: (res) => {
        const actives = (res?.data ?? []).filter((c: any) => c.isActive);
        this.categories.set(actives);
        this.applyCategoryFromUrl(actives);
        done('categories');
      },
      error: () => {
        this.error.set(true);
        done('categories');
      },
    });

    this.httpProduct.getProduct().subscribe({
      next: (res) => {
        this.products.set((res?.data ?? []).filter((p: any) => p.isActive));
        done('products');
      },
      error: () => {
        this.error.set(true);
        done('products');
      },
    });
  }

  /** Preselecciona una categoría si la URL trae `?categoria=<slug>`. */
  private applyCategoryFromUrl(categories: any[]): void {
    const slug = this.route.snapshot.queryParamMap.get('categoria');
    if (!slug) return;
    const match = categories.find((c) => c.slug === slug);
    if (match) {
      this.selectedCategoryId.set(match._id);
    } else {
      // slug pedido pero no existe como categoría activa (p. ej. `?categoria=hombre`
      // antes de que un admin cree esa categoría). No se inventa: se informa.
      this.unknownCategory.set(slug);
    }
  }

  protected selectCategory(id: string | null): void {
    this.unknownCategory.set(null);
    this.selectedCategoryId.set(id);
  }

  /** `product.category` llega como string id (sin poblar); se contempla objeto por robustez. */
  private categoryIdOf(product: any): string | null {
    const c = product?.category;
    if (!c) return null;
    return typeof c === 'string' ? c : (c._id ?? null);
  }

  /** Imagen principal del producto (misma lógica que home). */
  protected mainImage(images: { url: string; isMain: boolean }[]): string {
    if (!images || images.length === 0) return '';
    const main = images.find((img) => img.isMain);
    return main ? main.url : images[0].url;
  }

  protected hasImages(images: { url: string; isMain: boolean }[]): boolean {
    return !!images && images.length > 0;
  }
}
