import { Service, inject } from '@angular/core';
import Swal, { type SweetAlertIcon } from 'sweetalert2';

import { Toast } from '../../../core/services/toast';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  /** 'danger' pinta el botón en rojo (acciones destructivas). */
  tone?: 'default' | 'danger';
  icon?: SweetAlertIcon;
}

/**
 * Punto único para confirmaciones y toasts del panel. Reutiliza dependencias
 * YA presentes en el proyecto: `sweetalert2` (confirmaciones) y el servicio
 * `Toast` existente (avisos). No añade dependencias nuevas.
 *
 * El panel es CSR, pero igual se protege el acceso a `window` por si el árbol
 * llegara a evaluarse en SSR.
 */
@Service()
export class AdminDialog {
  private toast = inject(Toast);

  private get canUseDom(): boolean {
    return typeof window !== 'undefined' && typeof document !== 'undefined';
  }

  /** Confirmación modal. Resuelve `true` solo si el operador confirma. */
  async confirm(opts: ConfirmOptions): Promise<boolean> {
    if (!this.canUseDom) return false;
    const danger = opts.tone === 'danger';
    const result = await Swal.fire({
      title: opts.title,
      text: opts.message,
      icon: opts.icon ?? (danger ? 'warning' : 'question'),
      showCancelButton: true,
      reverseButtons: true,
      focusCancel: danger,
      confirmButtonText: opts.confirmText ?? (danger ? 'Eliminar' : 'Confirmar'),
      cancelButtonText: opts.cancelText ?? 'Cancelar',
      confirmButtonColor: danger ? '#a23b3b' : '#14120f',
      cancelButtonColor: '#8a847b',
      customClass: { popup: 'adm-swal' },
    });
    return result.isConfirmed === true;
  }

  /** Aviso de "cambios sin guardar" al abandonar un formulario sucio. */
  async confirmDiscard(): Promise<boolean> {
    return this.confirm({
      title: 'Descartar cambios',
      message: 'Hay cambios sin guardar en el formulario. ¿Seguro que quieres salir?',
      confirmText: 'Salir sin guardar',
      cancelText: 'Seguir editando',
      tone: 'danger',
    });
  }

  /**
   * Captura un texto obligatorio del operador (p. ej. el motivo de rechazo de
   * un producto, o el comentario de "solicitar cambios" — F6). Devuelve el
   * texto recortado, o `null` si cancela o deja el campo vacío/solo espacios
   * — el backend exige el comentario no vacío de todas formas
   * (`requiresComment` en `PRODUCT_TRANSITIONS`), pero se valida aquí también
   * para no abrir un request condenado a 400.
   *
   * `maxLength` refleja el límite REAL del backend del campo destino y por
   * defecto es 500 (`WorkflowHistoryEntrySchema.comment` /
   * `Product.rejectionReason` / `Order.statusHistory[].note`, todos
   * `maxlength: 500`). UI-5.2 lo pasa a 300 para `payment.note`
   * (`order.model.js`). No es un límite inventado aquí.
   */
  async promptText(opts: {
    title: string;
    message?: string;
    placeholder?: string;
    confirmText?: string;
    maxLength?: number;
  }): Promise<string | null> {
    if (!this.canUseDom) return null;
    const max = opts.maxLength ?? 500;
    const result = await Swal.fire({
      title: opts.title,
      text: opts.message,
      input: 'textarea',
      inputPlaceholder: opts.placeholder ?? '',
      inputAttributes: { maxlength: String(max) },
      showCancelButton: true,
      reverseButtons: true,
      confirmButtonText: opts.confirmText ?? 'Confirmar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#a23b3b',
      cancelButtonColor: '#8a847b',
      customClass: { popup: 'adm-swal' },
      inputValidator: (value) => (value?.trim() ? undefined : 'Este campo es obligatorio.'),
    });
    if (!result.isConfirmed) return null;
    const text = String(result.value ?? '').trim();
    return text || null;
  }

  success(message: string): void {
    this.toast.show(message, 'success');
  }

  error(message: string): void {
    this.toast.show(message, 'error');
  }
}
