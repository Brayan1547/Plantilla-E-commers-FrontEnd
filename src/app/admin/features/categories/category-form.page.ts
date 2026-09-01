import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';

import { AdminCategoriesApi, type CategoryPayload } from '../../core/services/admin-categories.api';
import { AdminDialog } from '../../core/services/admin-dialog';
import { normalizeError } from '../../core/services/api-error';
import type { HasUnsavedChanges } from '../../core/guards/unsaved-changes.guard';
import type { LoadState } from '../../core/models/admin.models';

import { PageHeaderComponent } from '../../shared/ui/page-header/page-header';
import { IconComponent } from '../../shared/ui/icon/icon';
import { SkeletonComponent } from '../../shared/ui/states/skeleton';
import { ErrorStateComponent } from '../../shared/ui/states/error-state';
import { slugify } from '../../shared/util/format.util';

const SLUG_PATTERN = /^[a-z0-9-]+$/;

@Component({
  selector: 'adm-category-form',
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
  templateUrl: './category-form.page.html',
})
export default class CategoryFormPage implements HasUnsavedChanges {
  private api = inject(AdminCategoriesApi);
  private dialog = inject(AdminDialog);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  protected readonly id = this.route.snapshot.paramMap.get('id');
  protected readonly isEdit = !!this.id;

  protected state = signal<LoadState>('ready');
  protected errorMsg = signal('');
  protected submitting = signal(false);
  private saved = signal(false);
  private slugTouched = false;

  protected form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(50)],
    }),
    slug: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(SLUG_PATTERN), Validators.maxLength(60)],
    }),
    description: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(250)],
    }),
    isActive: new FormControl(true, { nonNullable: true }),
  });

  protected title = computed(() => (this.isEdit ? 'Editar categoría' : 'Nueva categoría'));

  constructor() {
    if (this.isEdit) this.load();
  }

  private load(): void {
    this.state.set('loading');
    this.api
      .getById(this.id!)
      .pipe(catchError((err) => (this.fail(err), of(null))))
      .subscribe((cat) => {
        if (!cat) return;
        this.slugTouched = true; // en edición el slug ya existe, no autogenerar
        this.form.patchValue({
          name: cat.name,
          slug: cat.slug,
          description: cat.description ?? '',
          isActive: cat.isActive,
        });
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

  onNameInput(): void {
    if (this.slugTouched) return;
    this.form.controls.slug.setValue(slugify(this.form.controls.name.value), {
      emitEvent: false,
    });
  }

  markSlugTouched(): void {
    this.slugTouched = true;
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
    const payload: CategoryPayload = {
      name: v.name.trim(),
      slug: v.slug.trim(),
      description: v.description.trim(),
      isActive: v.isActive,
    };

    this.submitting.set(true);
    const req$ = this.isEdit
      ? this.api.update(this.id!, payload)
      : this.api.create(payload);

    req$.subscribe({
      next: () => {
        this.saved.set(true);
        this.submitting.set(false);
        this.dialog.success(this.isEdit ? 'Categoría actualizada.' : 'Categoría creada.');
        this.router.navigate(['/admin/categories']);
      },
      error: (err) => {
        this.submitting.set(false);
        this.dialog.error(normalizeError(err).message);
      },
    });
  }

  ctrl(name: 'name' | 'slug' | 'description') {
    return this.form.controls[name];
  }
}
