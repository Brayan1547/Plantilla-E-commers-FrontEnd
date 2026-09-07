import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';

import { AdminOrdersApi } from '../../core/services/admin-orders.api';
import { AdminDialog } from '../../core/services/admin-dialog';
import { PermissionsService } from '../../core/services/permissions';
import { normalizeError } from '../../core/services/api-error';
import type { LoadState } from '../../core/models/admin.models';
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_NOTE_MAX,
  PAYMENT_NOTE_MAX,
  PAYMENT_STATUS_LABELS,
  orderStatusLabel,
  orderStatusTone,
  orderTransitionOptions,
  paymentMethodLabel,
  paymentStatusLabel,
  paymentStatusTone,
  paymentTransitionOptions,
  type AdminOrderDetail,
  type OrderTransitionOption,
  type PaymentTransitionOption,
} from '../../core/models/admin-order.model';

import { PageHeaderComponent } from '../../shared/ui/page-header/page-header';
import { IconComponent } from '../../shared/ui/icon/icon';
import { StatusBadgeComponent } from '../../shared/ui/status-badge/status-badge';
import { SkeletonComponent } from '../../shared/ui/states/skeleton';
import { ErrorStateComponent } from '../../shared/ui/states/error-state';
import { formatDateTime, formatCurrencyCOP } from '../../shared/util/format.util';

@Component({
  selector: 'adm-order-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    PageHeaderComponent,
    IconComponent,
    StatusBadgeComponent,
    SkeletonComponent,
    ErrorStateComponent,
  ],
  templateUrl: './order-detail.page.html',
})
export default class OrderDetailPage {
  private api = inject(AdminOrdersApi);
  private dialog = inject(AdminDialog);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  protected perms = inject(PermissionsService);

  private readonly orderId = this.route.snapshot.paramMap.get('id') ?? '';

  protected readonly statusLabels = ORDER_STATUS_LABELS;
  protected readonly paymentLabels = PAYMENT_STATUS_LABELS;
  protected readonly orderStatusLabel = orderStatusLabel;
  protected readonly orderStatusTone = orderStatusTone;
  protected readonly paymentStatusLabel = paymentStatusLabel;
  protected readonly paymentStatusTone = paymentStatusTone;
  protected readonly paymentMethodLabel = paymentMethodLabel;
  protected readonly formatDateTime = formatDateTime;
  protected readonly formatCurrency = formatCurrencyCOP;

  protected order = signal<AdminOrderDetail | null>(null);
  protected state = signal<LoadState>('loading');
  protected errorMsg = signal('');
  protected busy = signal(false);

  /** Acciones de estado que la UI ofrece (el backend revalida siempre). */
  protected statusActions = computed<OrderTransitionOption[]>(() => {
    const o = this.order();
    if (!o || !this.perms.can('orders.manageStatus')) return [];
    return orderTransitionOptions(o.status);
  });

  protected paymentActions = computed<PaymentTransitionOption[]>(() => {
    const o = this.order();
    if (!o || !o.payment.status || !this.perms.can('orders.managePayment')) return [];
    return paymentTransitionOptions(o.payment.status);
  });

  /** true si el estado actual no admite ninguna transición (terminal en UI-5.1). */
  protected isTerminal = computed(() => {
    const o = this.order();
    return !!o && orderTransitionOptions(o.status).length === 0;
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.state.set('loading');
    this.api
      .getById(this.orderId)
      .pipe(catchError((err) => (this.fail(err), of(null))))
      .subscribe((o) => {
        if (!o) return;
        this.order.set(o);
        this.state.set('ready');
      });
  }

  retry(): void {
    this.load();
  }

  private fail(err: unknown): void {
    this.errorMsg.set(normalizeError(err).message);
    this.state.set('error');
  }

  // --- Acciones de workflow --------------------------------------------------

  async applyStatus(opt: OrderTransitionOption): Promise<void> {
    const o = this.order();
    if (!o || this.busy()) return;

    let note: string | undefined;
    if (opt.requiresNote) {
      // Cancelación: el prompt YA incluye confirmar/cancelar + valida no-vacío.
      const text = await this.dialog.promptText({
        title: opt.label,
        message: `El pedido ${o.orderNumber ?? ''} pasará a "${this.statusLabels[opt.to]}". Indica el motivo (queda en el historial).`,
        placeholder: 'Motivo de la cancelación',
        confirmText: opt.label,
        maxLength: ORDER_STATUS_NOTE_MAX,
      });
      if (!text) return;
      note = text;
    } else {
      const ok = await this.dialog.confirm({
        title: opt.label,
        message: `El pedido ${o.orderNumber ?? ''} pasará de "${this.statusLabels[o.status]}" a "${this.statusLabels[opt.to]}".`,
        confirmText: 'Confirmar',
        tone: opt.destructive ? 'danger' : 'default',
      });
      if (!ok) return;
    }

    this.busy.set(true);
    this.api.updateStatus(o.id, opt.to, note).subscribe({
      next: (updated) => {
        this.order.set(updated); // la respuesta ES el detalle actualizado (refresco)
        this.busy.set(false);
        this.dialog.success(
          opt.to === 'cancelled'
            ? 'Pedido cancelado. El backend restituyó el inventario.'
            : `Pedido actualizado a "${this.statusLabels[opt.to]}".`,
        );
      },
      error: (err) => {
        this.busy.set(false);
        this.handleMutationError(err);
      },
    });
  }

  async applyPayment(opt: PaymentTransitionOption): Promise<void> {
    const o = this.order();
    if (!o || this.busy()) return;

    let note: string | undefined;
    if (opt.requiresNote) {
      const text = await this.dialog.promptText({
        title: opt.label,
        message: `Se registrará el pago del pedido ${o.orderNumber ?? ''} como "${this.paymentLabels[opt.to]}". Indica el motivo.`,
        placeholder: 'Motivo (p. ej. el cliente no tenía efectivo)',
        confirmText: opt.label,
        maxLength: PAYMENT_NOTE_MAX,
      });
      if (!text) return;
      note = text;
    } else {
      const ok = await this.dialog.confirm({
        title: opt.label,
        message: `Se registrará el pago del pedido ${o.orderNumber ?? ''} como "${this.paymentLabels[opt.to]}". Esta acción no se puede revertir desde el panel.`,
        confirmText: 'Confirmar pago',
      });
      if (!ok) return;
    }

    this.busy.set(true);
    this.api.updatePayment(o.id, opt.to, note).subscribe({
      next: (updated) => {
        this.order.set(updated);
        this.busy.set(false);
        this.dialog.success(`Estado de pago actualizado a "${this.paymentLabels[opt.to]}".`);
      },
      error: (err) => {
        this.busy.set(false);
        this.handleMutationError(err);
      },
    });
  }

  /**
   * Concurrencia (§16): si otra persona modificó el pedido, el backend responde
   * 409. NO se sobrescribe el estado local: se avisa y se recarga el detalle
   * real. 403/422/404 muestran el mensaje del backend tal cual.
   */
  private handleMutationError(err: unknown): void {
    const n = normalizeError(err);
    if (n.status === 409) {
      this.dialog.error(
        'El pedido cambió mientras lo gestionabas. Se recargó con el estado actual; revisa antes de reintentar.',
      );
      this.load();
      return;
    }
    if (n.status === 404) {
      this.dialog.error('El pedido ya no está disponible.');
      this.router.navigate(['/admin/orders']);
      return;
    }
    this.dialog.error(n.message);
  }
}
