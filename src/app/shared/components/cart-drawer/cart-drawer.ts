import { Component, EventEmitter, Input, OnChanges, Output, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import { HttpCart } from '../../../core/services/http-cart';
import { GuestCart } from '../../../core/services/guest-cart';
import { HttpAuth } from '../../../core/services/http-auth';

/** Fila unificada del drawer — funciona para carrito guest y autenticado. */
interface DrawerLine {
  productId: string;
  name: string;
  price: number;
  image: string;
  quantity: number;
  available: boolean;
}

/**
 * Panel lateral del carrito. UI-4B: soporta DOS orígenes sin duplicar el
 * componente:
 *   - invitado     -> `GuestCart` (localStorage: solo `{productId, quantity}`).
 *   - autenticado  -> `HttpCart`  (carrito de backend, comportamiento sin cambios).
 *
 * El precio mostrado es informativo; el total real lo calcula el backend al
 * crear la orden.
 */
@Component({
  selector: 'app-cart-drawer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cart-drawer.html',
  styleUrl: './cart-drawer.css',
})
export class CartDrawer implements OnChanges {
  @Input() open = false;
  @Output() closed = new EventEmitter<void>();

  httpCart = inject(HttpCart);
  private guestCart = inject(GuestCart);
  private httpAuth = inject(HttpAuth);
  private router = inject(Router);

  /** Sesión activa -> carrito de backend; si no -> carrito de invitado. */
  protected readonly isGuest = computed(() => !this.httpAuth.user);

  /** Filas del carrito, unificadas desde la fuente que corresponda. */
  protected readonly lines = computed<DrawerLine[]>(() => {
    if (this.isGuest()) {
      return this.guestCart.hydrated().map((l) => ({
        productId: l.productId,
        name: l.product?.name ?? 'Producto no disponible',
        price: l.product?.price ?? 0,
        image: this.getMainImage(l.product?.images ?? []),
        quantity: l.quantity,
        available: !!l.product && l.product.isActive !== false && !l.unavailable,
      }));
    }
    const items = this.httpCart.cart()?.items ?? [];
    return items.map((it: any) => ({
      productId: it.productId?._id ?? it.productId,
      name: it.productId?.name ?? 'Producto',
      price: it.productId?.price ?? 0,
      image: this.getMainImage(it.productId?.images ?? []),
      quantity: it.quantity,
      available: it.productId?.isActive !== false,
    }));
  });

  protected readonly subtotal = computed(() =>
    this.lines().reduce((sum, l) => sum + l.price * l.quantity, 0),
  );

  protected readonly hasUnavailable = computed(() => this.lines().some((l) => !l.available));

  /** Angular llama a esto cuando cambian los `@Input()`; se aprovecha para hidratar. */
  ngOnChanges(): void {
    if (this.open && this.isGuest()) {
      this.guestCart.refreshHydration();
    }
  }

  close() {
    this.closed.emit();
  }

  increase(line: DrawerLine) {
    if (this.isGuest()) {
      this.guestCart.increment(line.productId);
      return;
    }
    this.httpCart.updateCart(line.productId, 1).subscribe({
      error: (err) => console.error('Error al aumentar cantidad', err),
    });
  }

  decrease(line: DrawerLine) {
    if (this.isGuest()) {
      this.guestCart.decrement(line.productId);
      return;
    }
    this.httpCart.updateCart(line.productId, -1).subscribe({
      error: (err) => console.error('Error al disminuir cantidad', err),
    });
  }

  remove(line: DrawerLine) {
    if (this.isGuest()) {
      this.guestCart.remove(line.productId);
      return;
    }
    this.httpCart.removeItem(line.productId).subscribe({
      error: (err) => console.error('Error al eliminar producto', err),
    });
  }

  getMainImage(images: { url: string; isMain?: boolean }[]): string {
    if (!images || images.length === 0) return '';
    const main = images.find((img) => img.isMain);
    return main ? main.url : images[0].url;
  }

  goToCheckout() {
    this.close();
    this.router.navigateByUrl('/checkout');
  }
}
