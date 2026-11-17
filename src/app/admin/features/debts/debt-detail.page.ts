import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';

import { AdminDebtsApi } from '../../core/services/admin-debts.api';
import { AdminDialog } from '../../core/services/admin-dialog';
import { PermissionsService } from '../../core/services/permissions';
import { normalizeError } from '../../core/services/api-error';
import type { LoadState } from '../../core/models/admin.models';
import {
  DEBT_DIRECTION_LABELS,
  DEBT_STATUS_LABELS,
  type Debt,
  type DebtPayment,
} from '../../core/models/debt.model';
import { bogotaToday } from '../dashboard/dashboard.models';

import { PageHeaderComponent } from '../../shared/ui/page-header/page-header';
import { IconComponent } from '../../shared/ui/icon/icon';
import { SkeletonComponent } from '../../shared/ui/states/skeleton';
import { ErrorStateComponent } from '../../shared/ui/states/error-state';
import { StatusBadgeComponent, type BadgeTone } from '../../shared/ui/status-badge/status-badge';
import { formatCurrencyCOP, formatDate, formatDateOnly } from '../../shared/util/format.util';

function integerValidator(control: AbstractControl): ValidationErrors | null {
  const v = control.value;
  return v === null || v === '' || Number.isInteger(v) ? null : { integer: true };
}

@Component({
  selector: 'adm-debt-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    PageHeaderComponent,
    IconComponent,
    SkeletonComponent,
    ErrorStateComponent,
    StatusBadgeComponent,
  ],
  templateUrl: './debt-detail.page.html',
})
export default class DebtDetailPage {
  private api = inject(AdminDebtsApi);
  private dialog = inject(AdminDialog);
  private route = inject(ActivatedRoute);
  protected perms = inject(PermissionsService);

  protected readonly id = this.route.snapshot.paramMap.get('id')!;
  protected readonly money = formatCurrencyCOP;
  protected readonly formatDate = formatDate;
  protected readonly formatDateOnly = formatDateOnly;
  protected readonly directionLabels = DEBT_DIRECTION_LABELS;
  protected readonly maxDate = bogotaToday();

  protected state = signal<LoadState>('loading');
  protected errorMsg = signal('');
  protected debt = signal<Debt | null>(null);
  protected submitting = signal(false);
  protected removingId = signal<string | null>(null);

  protected paymentForm = new FormGroup({
    amount: new FormControl<number | null>(null, {
      validators: [Validators.required, Validators.min(1), integerValidator],
    }),
    paidAt: new FormControl(bogotaToday(), { nonNullable: true }),
    note: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(200)] }),
  });

  /** Porcentaje abonado (0–100) para la barra de progreso. */
  protected progress = computed(() => {
    const d = this.debt();
    if (!d || d.amount <= 0) return 0;
    return Math.min(100, Math.round((d.paidAmount / d.amount) * 100));
  });

  protected statusTone = computed<BadgeTone>(() => {
    const d = this.debt();
    if (!d) return 'neutral';
    if (d.status === 'PAGADA') return 'ok';
    if (d.overdue) return 'danger';
    return d.status === 'PARCIAL' ? 'info' : 'warn';
  });

  protected statusText = computed(() => {
    const d = this.debt();
    if (!d) return '';
    return d.overdue ? 'Vencida' : DEBT_STATUS_LABELS[d.status];
  });

  /** Abonos del más reciente al más antiguo. */
  protected payments = computed<DebtPayment[]>(() =>
    [...(this.debt()?.payments ?? [])].sort(
      (a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime(),
    ),
  );

  constructor() {
    this.load();
  }

  load(): void {
    this.state.set('loading');
    this.api
      .getById(this.id)
      .pipe(catchError((err) => (this.fail(err), of(null))))
      .subscribe((debt) => {
        if (!debt) return;
        this.debt.set(debt);
        this.state.set('ready');
      });
  }

  private fail(err: unknown): void {
    this.errorMsg.set(normalizeError(err).message);
    this.state.set('error');
  }

  /** Rellena el campo con el saldo completo. */
  payAll(): void {
    const d = this.debt();
    if (d) this.paymentForm.controls.amount.setValue(d.balance);
  }

  submitPayment(): void {
    const d = this.debt();
    if (!d) return;
    if (this.paymentForm.invalid) {
      this.paymentForm.markAllAsTouched();
      return;
    }
    const v = this.paymentForm.getRawValue();
    const amount = v.amount as number;
    if (amount > d.balance) {
      this.dialog.error(`El abono no puede ser mayor al saldo (${formatCurrencyCOP(d.balance)}).`);
      return;
    }

    this.submitting.set(true);
    this.api
      .addPayment(this.id, {
        amount,
        paidAt: v.paidAt || undefined,
        note: v.note.trim() || undefined,
      })
      .subscribe({
        next: (updated) => {
          this.debt.set(updated);
          this.submitting.set(false);
          this.paymentForm.reset({ amount: null, paidAt: bogotaToday(), note: '' });
          this.dialog.success(updated.status === 'PAGADA' ? 'Deuda pagada por completo.' : 'Abono registrado.');
        },
        error: (err) => {
          this.submitting.set(false);
          this.dialog.error(normalizeError(err).message);
        },
      });
  }

  async removePayment(p: DebtPayment): Promise<void> {
    const ok = await this.dialog.confirm({
      title: 'Eliminar abono',
      message: `Se eliminará el abono de ${formatCurrencyCOP(p.amount)} y el saldo de la deuda volverá a subir.`,
      confirmText: 'Eliminar',
      tone: 'danger',
    });
    if (!ok) return;
    this.removingId.set(p._id);
    this.api.removePayment(this.id, p._id).subscribe({
      next: (updated) => {
        this.debt.set(updated);
        this.removingId.set(null);
        this.dialog.success('Abono eliminado.');
      },
      error: (err) => {
        this.removingId.set(null);
        this.dialog.error(normalizeError(err).message);
      },
    });
  }
}
