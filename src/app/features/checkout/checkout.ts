import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { HttpAuth } from '../../core/services/http-auth';
import { HttpCart } from '../../core/services/http-cart';
import { GuestCart } from '../../core/services/guest-cart';
import { HttpOrder } from '../../core/services/http-order';
import { Toast } from '../../core/services/toast';
import { CreateOrderItem, CreateOrderPayload } from '../../core/models/order.model';

/** Fila unificada del resumen — sirve para carrito guest y autenticado. */
interface CheckoutLine {
  productId: string;
  /** TALLAS — talla de la línea (`undefined` = producto simple). Identidad = productId + size. */
  size?: string;
  name: string;
  price: number;
  image: string;
  quantity: number;
  available: boolean;
}

/**
 * UI-4B — Checkout COD (invitado o autenticado).
 *
 * Fuente de ítems:
 *   - invitado       -> `GuestCart` (localStorage: `{productId, quantity, size?}`).
 *   - autenticado    -> `HttpCart` (carrito de backend).
 *
 * TALLAS — cada línea se identifica por (productId + size); `size` es opcional
 * (producto simple no la lleva) y viaja al pedido como `{productId, quantity,
 * size}`. El precio y el subtotal que se muestran son SOLO informativos: la
 * autoridad de precios, totales y stock es el backend al crear la orden
 * (`POST /api/orders`).
 *
 * NO hace merge guest -> autenticado. NO modifica `HttpCart`. NO envía
 * price/totals/status/payment/userId. Pago EXCLUSIVO: contra entrega.
 */
@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './checkout.html',
  styleUrl: './checkout.css',
})
export default class Checkout {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private httpAuth = inject(HttpAuth);
  private httpCart = inject(HttpCart);
  private guestCart = inject(GuestCart);
  private httpOrder = inject(HttpOrder);
  private toast = inject(Toast);

  /** Modo de compra. Snapshot al entrar; solo `continuarComoInvitado()` lo cambia. */
  protected readonly isGuest = signal(!this.httpAuth.user);

  protected readonly submitting = signal(false);
  protected readonly loadingCart = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  /** true tras un 401 al enviar: sesión expirada, decisión explícita del usuario. */
  protected readonly sessionExpired = signal(false);

  /**
   * Clave de idempotencia del INTENTO actual. Se genera en el primer envío y se
   * CONSERVA para los reintentos del mismo intento (UI-4B §15). No se guarda en
   * localStorage. No se regenera por doble click ni por "Reintentar".
   */
  private idempotencyKey: string | null = null;

  protected readonly form = this.fb.nonNullable.group({
    recipientName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80)]],
    phone: ['', [Validators.required, Validators.pattern(/^3\d{9}$/)]],
    email: ['', [Validators.required, Validators.pattern(/^\S+@\S+\.\S+$/), Validators.maxLength(120)]],
    documentId: ['', [Validators.maxLength(20)]],
    department: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(60)]],
    city: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80)]],
    neighborhood: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80)]],
    address: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(160)]],
    addressComplement: ['', [Validators.maxLength(80)]],
    reference: ['', [Validators.maxLength(160)]],
    notes: ['', [Validators.maxLength(500)]],
  });

  /** Filas del resumen, unificadas desde la fuente que corresponda. */
  protected readonly lines = computed<CheckoutLine[]>(() => {
    if (this.isGuest()) {
      return this.guestCart.hydrated().map((l) => ({
        productId: l.productId,
        size: l.size,
        name: l.product?.name ?? 'Producto no disponible',
        price: l.product?.price ?? 0,
        image: this.mainImage(l.product?.images),
        quantity: l.quantity,
        available: !!l.product && l.product.isActive !== false && !l.unavailable,
      }));
    }
    const items = this.httpCart.cart()?.items ?? [];
    return items.map((it: any) => ({
      productId: it.productId?._id ?? it.productId,
      size: it.size ?? undefined,
      name: it.productId?.name ?? 'Producto',
      price: it.productId?.price ?? 0,
      image: this.mainImage(it.productId?.images),
      quantity: it.quantity,
      available: it.productId?.isActive !== false && (it.productId?.stock ?? 1) > 0,
    }));
  });

  protected readonly subtotal = computed(() =>
    this.lines().reduce((sum, l) => sum + l.price * l.quantity, 0),
  );

  protected readonly isEmpty = computed(() => this.lines().length === 0);
  protected readonly hasUnavailable = computed(() => this.lines().some((l) => !l.available));

  ngOnInit(): void {
    if (this.isGuest()) {
      this.guestCart.refreshHydration();
      return;
    }
    // Autenticado: asegurar que el carrito de backend esté cargado (acceso directo a /checkout).
    if ((this.httpCart.cart()?.items?.length ?? 0) === 0) {
      this.loadingCart.set(true);
      this.httpCart.getMyCart().subscribe({
        next: () => this.loadingCart.set(false),
        error: () => this.loadingCart.set(false),
      });
    }
  }

  // --- Edición del resumen -------------------------------------------

  protected removeLine(productId: string, size?: string): void {
    if (this.isGuest()) {
      this.guestCart.remove(productId, size);
      return;
    }
    this.httpCart.removeItem(productId, size).subscribe({
      error: () => this.toast.show('No se pudo actualizar el carrito', 'error'),
    });
  }

  // --- Envío --------------------------------------------------------

  protected submit(): void {
    if (this.submitting()) return;
    this.errorMessage.set(null);

    if (this.isEmpty()) {
      this.errorMessage.set('Tu carrito está vacío.');
      return;
    }
    if (this.hasUnavailable()) {
      this.errorMessage.set('Quita los productos no disponibles antes de continuar.');
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errorMessage.set('Revisa los campos marcados en el formulario.');
      this.focusFirstInvalid();
      return;
    }

    const payload = this.buildPayload();
    if (payload.items.length === 0) {
      this.errorMessage.set('Tu carrito está vacío.');
      return;
    }

    this.idempotencyKey ??= this.newKey();
    this.submitting.set(true);

    this.httpOrder.createOrder(payload, this.idempotencyKey).subscribe({
      next: (order) => {
        // Limpieza del carrito SOLO tras el 201 confirmado (UI-4B §19).
        if (this.isGuest()) {
          this.guestCart.clear();
        } else {
          // El backend ya borró el carrito del usuario tras crear la orden;
          // se sincroniza el estado local sin una segunda petición.
          this.httpCart.cart.set({ items: [] });
          this.httpCart.cartCount.set(0);
        }
        this.submitting.set(false);
        this.router.navigate(['/checkout/confirmacion'], { state: { order } });
      },
      error: (err: HttpErrorResponse) => {
        this.submitting.set(false);
        this.handleError(err);
      },
    });
  }

  /** Tras un 401: el usuario elige explícitamente seguir como invitado. */
  protected continuarComoInvitado(): void {
    const current = this.lines();
    for (const l of current) {
      this.guestCart.add(l.productId, l.quantity, l.size);
    }
    this.isGuest.set(true);
    this.sessionExpired.set(false);
    this.errorMessage.set(null);
    this.guestCart.refreshHydration();
    this.toast.show('Continúas como invitado. Revisa tus datos y finaliza el pedido.');
  }

  protected irALogin(): void {
    this.router.navigate(['/login'], { queryParams: { returnUrl: '/checkout' } });
  }

  // --- Helpers -----------------------------------------------------

  private buildPayload(): CreateOrderPayload {
    const v = this.form.getRawValue();
    const trim = (s: string) => s.trim();
    /** Devuelve el texto sin espacios, o `undefined` si queda vacío. */
    const opt = (s: string): string | undefined => {
      const t = s.trim();
      return t.length ? t : undefined;
    };

    const items: CreateOrderItem[] = this.lines().map((l) =>
      // TALLAS — `size` solo para líneas con talla; producto simple envía
      // exactamente `{ productId, quantity }`.
      l.size ? { productId: l.productId, quantity: l.quantity, size: l.size } : { productId: l.productId, quantity: l.quantity },
    );

    const documentId = opt(v.documentId);
    const addressComplement = opt(v.addressComplement);
    const reference = opt(v.reference);
    const notes = opt(v.notes);

    const payload: CreateOrderPayload = {
      items,
      customer: {
        recipientName: trim(v.recipientName),
        phone: trim(v.phone),
        email: trim(v.email),
        ...(documentId ? { documentId } : {}),
      },
      shippingAddress: {
        department: trim(v.department),
        city: trim(v.city),
        neighborhood: trim(v.neighborhood),
        address: trim(v.address),
        ...(addressComplement ? { addressComplement } : {}),
        ...(reference ? { reference } : {}),
      },
      ...(notes ? { notes } : {}),
    };
    return payload;
  }

  private handleError(err: HttpErrorResponse): void {
    const status = err?.status ?? 0;
    const backendMsg: string | undefined = err?.error?.msg;

    if (status === 401) {
      this.sessionExpired.set(true);
      this.errorMessage.set(
        'Tu sesión ha expirado. Puedes iniciar sesión nuevamente o continuar como invitado.',
      );
      return;
    }

    let msg: string;
    switch (status) {
      case 0:
        msg = 'No pudimos conectar con el servidor. Revisa tu conexión e inténtalo nuevamente.';
        break;
      case 400:
        msg = 'Algunos datos del pedido no son válidos. Revisa el formulario e inténtalo nuevamente.';
        break;
      case 404:
        msg = 'Uno de los productos ya no está disponible. Revisa tu carrito.';
        break;
      case 409:
        msg = /stock/i.test(backendMsg ?? '')
          ? 'Uno de los productos ya no tiene stock suficiente. Revisa tu carrito.'
          : 'Ya hay un pedido en proceso. Espera unos segundos e inténtalo de nuevo.';
        break;
      case 422:
        msg =
          backendMsg ??
          'Alguno de los productos no se puede comprar en línea. Revisa tu carrito.';
        break;
      case 500:
        msg = 'No pudimos procesar tu pedido. Inténtalo nuevamente en unos minutos.';
        break;
      default:
        msg = 'No pudimos procesar tu pedido. Inténtalo nuevamente.';
    }
    this.errorMessage.set(msg);
    // El carrito NUNCA se limpia ante un error: el usuario puede reintentar.
  }

  /** Mensaje de validación en español para un control (o `null` si está OK / intacto). */
  protected errorText(name: string): string | null {
    const ctrl = this.form.get(name);
    if (!ctrl || ctrl.valid || !(ctrl.touched || ctrl.dirty)) return null;
    const e = ctrl.errors ?? {};
    if (e['required']) return 'Este campo es obligatorio.';
    if (e['minlength']) return `Mínimo ${e['minlength'].requiredLength} caracteres.`;
    if (e['maxlength']) return `Máximo ${e['maxlength'].requiredLength} caracteres.`;
    if (e['pattern']) {
      if (name === 'phone') return 'Escribe un móvil colombiano de 10 dígitos (empieza por 3).';
      if (name === 'email') return 'Escribe un correo válido.';
      return 'El formato no es válido.';
    }
    return 'El valor no es válido.';
  }

  private mainImage(images?: { url: string; isMain?: boolean }[]): string {
    if (!images || images.length === 0) return '';
    const main = images.find((i) => i.isMain);
    return main ? main.url : images[0].url;
  }

  private focusFirstInvalid(): void {
    if (typeof document === 'undefined') return;
    queueMicrotask(() => {
      const el = document.querySelector('.checkout-form .ng-invalid') as HTMLElement | null;
      el?.focus();
    });
  }

  private newKey(): string {
    const c = (globalThis as unknown as { crypto?: { randomUUID?: () => string } }).crypto;
    if (c?.randomUUID) return c.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
      const r = (Math.random() * 16) | 0;
      const val = ch === 'x' ? r : (r & 0x3) | 0x8;
      return val.toString(16);
    });
  }
}
