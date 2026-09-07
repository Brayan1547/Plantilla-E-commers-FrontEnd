import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

import { PAYMENT_METHOD_COD, type OrderConfirmation } from '../../../core/models/order.model';

/**
 * UI-4B — Confirmación del pedido (`/checkout/confirmacion`).
 *
 * Renderiza EXCLUSIVAMENTE la respuesta 201 de `POST /api/orders`, recibida por
 * el estado de navegación del router (`state: { order }`). NO consulta ningún
 * endpoint: no existe `GET /orders/:id` público y no se crea.
 *
 * Si se entra sin estado (refresh / enlace directo) se muestra un mensaje
 * neutro y un enlace a la tienda — no se persiste PII para "recuperar" la orden.
 */
@Component({
  selector: 'app-checkout-confirmation',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './checkout-confirmation.html',
  styleUrl: './checkout-confirmation.css',
})
export default class CheckoutConfirmation {
  private router = inject(Router);

  protected readonly order = signal<OrderConfirmation | null>(this.readOrderFromNavigation());

  protected readonly isCod = computed(() => this.order()?.payment?.method === PAYMENT_METHOD_COD);

  private readOrderFromNavigation(): OrderConfirmation | null {
    const fromNav = this.router.getCurrentNavigation()?.extras?.state?.['order'];
    if (fromNav) return fromNav as OrderConfirmation;
    // Tras completar la navegación, el estado vive en history.state (solo navegador).
    if (typeof history !== 'undefined' && history.state && history.state['order']) {
      return history.state['order'] as OrderConfirmation;
    }
    return null;
  }
}
