import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';

import { AdminUsersApi, type CreateUserPayload, type UpdateProfilePayload } from '../../core/services/admin-users.api';
import { AdminRolesApi } from '../../core/services/admin-roles.api';
import { AdminDialog } from '../../core/services/admin-dialog';
import { normalizeError } from '../../core/services/api-error';
import type { HasUnsavedChanges } from '../../core/guards/unsaved-changes.guard';
import type { AdminRole } from '../../core/models/permission.model';
import type { LoadState } from '../../core/models/admin.models';

import { PageHeaderComponent } from '../../shared/ui/page-header/page-header';
import { IconComponent } from '../../shared/ui/icon/icon';
import { SkeletonComponent } from '../../shared/ui/states/skeleton';
import { ErrorStateComponent } from '../../shared/ui/states/error-state';

@Component({
  selector: 'adm-user-form',
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
  templateUrl: './user-form.page.html',
})
export default class UserFormPage implements HasUnsavedChanges {
  private api = inject(AdminUsersApi);
  private rolesApi = inject(AdminRolesApi);
  private dialog = inject(AdminDialog);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  /** Opciones de rol desde `GET /roles` (fallback local si falla). */
  protected readonly roleOptions = this.rolesApi.options;

  protected readonly userId = this.route.snapshot.paramMap.get('id');
  protected readonly isEdit = !!this.userId;

  protected state = signal<LoadState>('ready');
  protected errorMsg = signal('');
  protected submitting = signal(false);
  private saved = signal(false);

  /**
   * En CREAR: perfil + role + status.
   * En EDITAR: SOLO perfil (`PATCH /users/:id` ignora role/status; esos se
   * gestionan en el detalle vía `/role` y `/status`).
   */
  protected form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(50)],
    }),
    nickname: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(3), Validators.maxLength(20)],
    }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('', { nonNullable: true }),
    avatar: new FormControl('', { nonNullable: true }),
    role: new FormControl<AdminRole>('subscriber', { nonNullable: true }),
    status: new FormControl(true, { nonNullable: true }),
  });

  protected title = computed(() => (this.isEdit ? 'Editar perfil' : 'Nuevo usuario'));

  constructor() {
    this.rolesApi.ensureLoaded();
    if (this.isEdit) {
      this.form.controls.password.setValidators([Validators.minLength(6)]);
      this.loadUser();
    } else {
      this.form.controls.password.setValidators([Validators.required, Validators.minLength(6)]);
    }
    this.form.controls.password.updateValueAndValidity();
  }

  private loadUser(): void {
    this.state.set('loading');
    this.api
      .getById(this.userId!)
      .pipe(catchError((err) => (this.fail(err), of(null))))
      .subscribe((u) => {
        if (!u) return;
        this.form.patchValue({
          name: u.name,
          nickname: u.nickname,
          email: u.email,
          avatar: u.avatar ?? '',
          role: u.role,
          status: u.status,
        });
        this.form.markAsPristine();
        this.state.set('ready');
      });
  }

  retry(): void {
    this.loadUser();
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
    this.submitting.set(true);
    const v = this.form.getRawValue();

    if (this.isEdit) {
      const payload: UpdateProfilePayload = {
        name: v.name.trim(),
        nickname: v.nickname.trim(),
        email: v.email.trim(),
        avatar: v.avatar.trim(),
      };
      if (v.password) payload.password = v.password;

      this.api.updateProfile(this.userId!, payload).subscribe({
        next: () => this.done('Perfil actualizado.', ['/admin/users', this.userId!]),
        error: (err) => this.reject(err),
      });
    } else {
      const payload: CreateUserPayload = {
        name: v.name.trim(),
        nickname: v.nickname.trim(),
        email: v.email.trim(),
        password: v.password,
        role: v.role,
        status: v.status,
        avatar: v.avatar.trim() || undefined,
      };
      this.api.create(payload).subscribe({
        next: (created) => this.done('Usuario creado.', ['/admin/users', created._id]),
        error: (err) => this.reject(err),
      });
    }
  }

  private done(msg: string, commands: unknown[]): void {
    this.saved.set(true);
    this.submitting.set(false);
    this.dialog.success(msg);
    this.router.navigate(commands as string[]);
  }

  private reject(err: unknown): void {
    this.submitting.set(false);
    this.dialog.error(normalizeError(err).message);
  }

  ctrl(name: 'name' | 'nickname' | 'email' | 'password' | 'avatar') {
    return this.form.controls[name];
  }
}
