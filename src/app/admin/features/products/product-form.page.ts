import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  FormArray,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';

import { AdminProductsApi, type ProductPayload } from '../../core/services/admin-products.api';
import { AdminCategoriesApi } from '../../core/services/admin-categories.api';
import { AdminDialog } from '../../core/services/admin-dialog';
import { normalizeError } from '../../core/services/api-error';
import type { HasUnsavedChanges } from '../../core/guards/unsaved-changes.guard';
import {
  categoryId,
  type AdminCategory,
  type LoadState,
  type ProductImage,
} from '../../core/models/admin.models';

import { PageHeaderComponent } from '../../shared/ui/page-header/page-header';
import { IconComponent } from '../../shared/ui/icon/icon';
import { SkeletonComponent } from '../../shared/ui/states/skeleton';
import { ErrorStateComponent } from '../../shared/ui/states/error-state';
import { slugify } from '../../shared/util/format.util';

const SLUG_PATTERN = /^[a-z0-9-]+$/;

function imageGroup(img?: ProductImage) {
  return new FormGroup({
    url: new FormControl(img?.url ?? '', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    isMain: new FormControl(img?.isMain ?? false, { nonNullable: true }),
  });
}

@Component({
  selector: 'adm-product-form',
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
  templateUrl: './product-form.page.html',
})
export default class ProductFormPage implements HasUnsavedChanges {
  private api = inject(AdminProductsApi);
  private categoriesApi = inject(AdminCategoriesApi);
  private dialog = inject(AdminDialog);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  protected readonly id = this.route.snapshot.paramMap.get('id');
  protected readonly isEdit = !!this.id;

  protected state = signal<LoadState>('loading');
  protected errorMsg = signal('');
  protected submitting = signal(false);
  protected categories = signal<AdminCategory[]>([]);
  private saved = signal(false);
  private slugTouched = false;

  protected form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(100)],
    }),
    slug: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(SLUG_PATTERN)],
    }),
    description: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(500)],
    }),
    price: new FormControl<number>(0, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0)],
    }),
    stock: new FormControl<number>(0, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0)],
    }),
    category: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    isActive: new FormControl(true, { nonNullable: true }),
    images: new FormArray<ReturnType<typeof imageGroup>>([]),
  });

  protected get images(): FormArray<ReturnType<typeof imageGroup>> {
    return this.form.controls.images;
  }

  protected title = computed(() => (this.isEdit ? 'Editar producto' : 'Nuevo producto'));

  constructor() {
    this.load();
  }

  private load(): void {
    this.state.set('loading');
    forkJoin({
      categories: this.categoriesApi.list(),
      product: this.isEdit ? this.api.getById(this.id!) : of(null),
    })
      .pipe(catchError((err) => (this.fail(err), of(null))))
      .subscribe((res) => {
        if (!res) return;
        this.categories.set(res.categories);

        if (res.product) {
          const p = res.product;
          this.slugTouched = true;
          this.form.patchValue({
            name: p.name,
            slug: p.slug,
            description: p.description ?? '',
            price: p.price,
            stock: p.stock,
            category: categoryId(p.category) ?? '',
            isActive: p.isActive,
          });
          this.images.clear();
          for (const img of p.images ?? []) this.images.push(imageGroup(img));
        }
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
    this.form.controls.slug.setValue(slugify(this.form.controls.name.value), { emitEvent: false });
  }

  markSlugTouched(): void {
    this.slugTouched = true;
  }

  addImage(): void {
    this.images.push(imageGroup());
    this.images.markAsDirty();
  }

  removeImage(index: number): void {
    this.images.removeAt(index);
    this.images.markAsDirty();
  }

  setMain(index: number): void {
    this.images.controls.forEach((g, i) => g.controls.isMain.setValue(i === index));
    this.images.markAsDirty();
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

    const images: ProductImage[] = v.images
      .filter((img) => img.url.trim().length > 0)
      .map((img) => ({ url: img.url.trim(), isMain: img.isMain }));
    if (images.length && !images.some((img) => img.isMain)) {
      images[0].isMain = true;
    }

    const payload: ProductPayload = {
      name: v.name.trim(),
      slug: v.slug.trim(),
      description: v.description.trim(),
      price: Number(v.price),
      stock: Number(v.stock),
      category: v.category,
      isActive: v.isActive,
      images,
    };

    this.submitting.set(true);
    const req$ = this.isEdit ? this.api.update(this.id!, payload) : this.api.create(payload);

    req$.subscribe({
      next: () => {
        this.saved.set(true);
        this.submitting.set(false);
        this.dialog.success(this.isEdit ? 'Producto actualizado.' : 'Producto creado.');
        this.router.navigate(['/admin/products']);
      },
      error: (err) => {
        this.submitting.set(false);
        this.dialog.error(normalizeError(err).message);
      },
    });
  }

  ctrl(name: 'name' | 'slug' | 'description' | 'price' | 'stock' | 'category') {
    return this.form.controls[name];
  }
}
