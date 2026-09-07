import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import CheckoutConfirmation from './checkout-confirmation';
import type { OrderConfirmation } from '../../../core/models/order.model';

const ORDER: OrderConfirmation = {
  id: 'order1',
  orderNumber: 'DUSCK-2026-000123',
  status: 'pending_confirmation',
  userId: null,
  items: [
    {
      productId: 'a'.repeat(24),
      productName: 'Camiseta Essential',
      slug: 'camiseta',
      image: null,
      unitPrice: 50000,
      quantity: 2,
      subtotal: 100000,
    },
  ],
  totals: { itemsSubtotal: 100000, shipping: 0, grandTotal: 100000, currency: 'COP' },
  payment: { method: 'cash_on_delivery', status: 'pending' },
  customer: { recipientName: 'Ana Gómez', phone: '3001234567', email: 'ana@dusck.co' },
  shippingAddress: {
    department: 'Antioquia',
    city: 'Medellín',
    neighborhood: 'Laureles',
    address: 'Calle 12 # 34-56',
  },
  createdAt: new Date().toISOString(),
};

function setup(order: OrderConfirmation | null) {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const router = TestBed.inject(Router);
  vi.spyOn(router, 'getCurrentNavigation').mockReturnValue(
    { extras: { state: order ? { order } : {} } } as any,
  );
  const fixture = TestBed.createComponent(CheckoutConfirmation);
  fixture.detectChanges();
  return fixture;
}

describe('CheckoutConfirmation', () => {
  it('muestra orderNumber, estado, total del backend, productos, entrega y COD', () => {
    const fixture = setup(ORDER);
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('DUSCK-2026-000123');
    expect(text).toContain('pending_confirmation');
    expect(text).toContain('Camiseta Essential');
    expect(text).toContain('Ana Gómez');
    expect(text).toContain('Laureles');
    expect(text).toContain('Pago contra entrega');
    expect((fixture.componentInstance as any).isCod()).toBe(true);
    // El total mostrado es el del backend (grandTotal), no un cálculo del front.
    expect((fixture.componentInstance as any).order().totals.grandTotal).toBe(100000);
  });

  it('sin estado de navegación -> mensaje neutro, sin PII', () => {
    const fixture = setup(null);
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Gracias por tu compra');
    expect(text).not.toContain('Ana Gómez');
  });
});
