import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';

import { AdminDebtsApi } from '../../core/services/admin-debts.api';
import { AdminDialog } from '../../core/services/admin-dialog';
import { normalizeError } from '../../core/services/api-error';
import type { HasUnsavedChanges } from '../../core/guards/unsaved-changes.guard';
import type { LoadState } from '../../core/models/admin.models';
import type { DebtDirection, DebtPayload } from '../../core/models/debt.model';

import { PageHeaderComponent } from '../../shared/ui/page-header/page-header';
import { IconComponent } from '../../shared/ui/icon/icon';
import { SkeletonComponent } from '../../shared/ui/states/skeleton';
import { ErrorStateComponent } from '../../shared/ui/states/error-state';

/** El monto debe ser un número entero (pesos, sin decimales). */
function integerValidator(control: AbstractControl): ValidationErrors | null {
  const v = control.value;
  return v === null || v === '' || Number.isInteger(v) ? null : { integer: true };
}

@Component({
  selector: 'adm-debt-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    PageHeaderComponent,
    IconComponent,
    SkeletonComponent,
    ErrorStateComponent,
  ],
  templateUrl: './debt-form.page.html',
})
export default class DebtFormPage implements HasUnsavedChanges {
  private api = inject(AdminDebtsApi);
  private dialog = inject(AdminDialog);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  protected readonly id = this.route.snapshot.paramMap.get('id');
  protected readonly isEdit = !!this.id;

  protected state = signal<LoadState>('ready');
  protected errorMsg = signal('');
  protected submitting = signal(false);
  private saved = signal(false);

  protected form = new FormGroup({
    direction: new FormControl<DebtDirection>('ME_DEBEN', { nonNullable: true }),
    personName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(80)],
    }),
    personPhone: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(30)],
    }),
    amount: new FormControl<number | null>(null, {
      validators: [Validators.required, Validators.min(1), integerValidator],
    }),
    dueDate: new FormControl('', { nonNullable: true }),
    concept: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(250)] }),
    notes: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(500)] }),
  });

  protected title = computed(() => (this.isEdit ? 'Editar deuda' : 'Nueva deuda'));

  constructor() {
    if (this.isEdit) this.load();
  }

  private load(): void {
    this.state.set('loading');
    this.api
      .getById(this.id!)
      .pipe(catchError((err) => (this.fail(err), of(null))))
      .subscribe((debt) => {
        if (!debt) return;
        this.form.patchValue({
          direction: debt.direction,
          personName: debt.personName,
          personPhone: debt.personPhone ?? '',
          amount: debt.amount,
          dueDate: debt.dueDate ?? '',
          concept: debt.concept ?? '',
          notes: debt.notes ?? '',
        });
        // El tipo no se cambia después de crear la deuda.
        this.form.controls.direction.disable();
        this.form.markAsPristine();
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

  hasUnsavedChanges(): boolean {
    return this.form.dirty && !this.saved();
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const payload: DebtPayload = {
      personName: v.personName.trim(),
      personPhone: v.personPhone.trim(),
      amount: v.amount as number,
      concept: v.concept.trim(),
      notes: v.notes.trim(),
      // Al editar, '' quita la fecha límite (null); al crear, simplemente no se envía.
      ...(this.isEdit ? { dueDate: v.dueDate || null } : v.dueDate ? { dueDate: v.dueDate } : {}),
      ...(this.isEdit ? {} : { direction: v.direction }),
    };

    this.submitting.set(true);
    const req$ = this.isEdit ? this.api.update(this.id!, payload) : this.api.create(payload);

    req$.subscribe({
      next: (debt) => {
        this.saved.set(true);
        this.submitting.set(false);
        this.dialog.success(this.isEdit ? 'Deuda actualizada.' : 'Deuda registrada.');
        this.router.navigate(['/admin/debts', debt._id]);
      },
      error: (err) => {
        this.submitting.set(false);
        this.dialog.error(normalizeError(err).message);
      },
    });
  }

  ctrl(name: 'personName' | 'personPhone' | 'amount' | 'concept' | 'notes') {
    return this.form.controls[name];
  }
}
