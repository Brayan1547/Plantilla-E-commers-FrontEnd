import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpCart } from '../../../core/services/http-cart';

@Component({
  selector: 'app-cart-drawer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cart-drawer.html',
  styleUrl: './cart-drawer.css',
})
export class CartDrawer {

  // true/false para saber si el panel está abierto; lo controla el header (componente padre)
  @Input() open = false;

  // avisa al header que debe cerrar el drawer (ej. al hacer click en el overlay)
  @Output() closed = new EventEmitter<void>();

  httpCart = inject(HttpCart); // acceso directo al signal del carrito
  private router = inject(Router);

  // Atajo para leer los items del carrito sin repetir "httpCart.cart().items" en el html
  get items(): any[] {
    return this.httpCart.cart()?.items || [];
  }

  // Suma total del carrito (precio * cantidad de cada item)
  get subtotal(): number {
    return this.items.reduce((sum, item) => {
      const price = item.productId?.price || 0;
      return sum + price * item.quantity;
    }, 0);
  }

  close() {
    this.closed.emit();
  }

  // Suma 1 unidad al item (botón "+")
  increase(item: any) {
    this.httpCart.updateCart(item.productId._id, 1).subscribe({
      error: (err) => console.error('Error al aumentar cantidad', err)
    });
  }

  // Resta 1 unidad al item (botón "-"); si llega a 0 el backend lo elimina solo
  decrease(item: any) {
    this.httpCart.updateCart(item.productId._id, -1).subscribe({
      error: (err) => console.error('Error al disminuir cantidad', err)
    });
  }

  // Elimina el producto del carrito sin importar la cantidad (botón "eliminar")
  remove(item: any) {
    this.httpCart.removeItem(item.productId._id).subscribe({
      error: (err) => console.error('Error al eliminar producto', err)
    });
  }

  // Obtiene la imagen principal del producto (mismo patrón que home.ts)
  getMainImage(images: { url: string; isMain: boolean }[]): string {
    if (!images || images.length === 0) return '';
    const main = images.find(img => img.isMain);
    return main ? main.url : images[0].url;
  }

  // Cierra el drawer y lleva al checkout
  goToCheckout() {
    this.close();
    this.router.navigateByUrl('/checkout');
  }
}