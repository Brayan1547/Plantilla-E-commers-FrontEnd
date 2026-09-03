import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  FormArray,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, forkJoin, of } from 'rxjs';

import { AdminProductsApi, type ProductPayload } from '../../core/services/admin-products.api';
import { AdminCategoriesApi } from '../../core/services/admin-categories.api';
import { AdminDialog } from '../../core/services/admin-dialog';
import { PermissionsService } from '../../core/services/permissions';
import { normalizeError } from '../../core/services/api-error';
import type { HasUnsavedChanges } from '../../core/guards/unsaved-changes.guard';
import {
  categoryIds,
  isContentEditableStatus,
  PRODUCT_STATUS_LABELS,
  PRODUCT_STATUS_TONE,
  type AdminCategory,
  type AdminProduct,
  type LoadState,
  type ProductImage,
  type ProductVariant,
} from '../../core/models/admin.models';

import { PageHeaderComponent } from '../../shared/ui/page-header/page-header';
import { IconComponent } from '../../shared/ui/icon/icon';
import { SkeletonComponent } from '../../shared/ui/states/skeleton';
import { ErrorStateComponent } from '../../shared/ui/states/error-state';
import { StatusBadgeComponent } from '../../shared/ui/status-badge/status-badge';
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

function variantGroup(v?: ProductVariant) {
  return new FormGroup({
    sku: new FormControl(v?.sku ?? '', { nonNullable: true }),
    color: new FormControl(v?.color ?? '', { nonNullable: true }),
    size: new FormControl(v?.size ?? '', { nonNullable: true }),
    stock: new FormControl<number>(v?.stock ?? 0, { nonNullable: true, validators: [Validators.min(0)] }),
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
    StatusBadgeComponent,
  ],
  templateUrl: './product-form.page.html',
})
export default class ProductFormPage implements HasUnsavedChanges {
  private api = inject(AdminProductsApi);
  private categoriesApi = inject(AdminCategoriesApi);
  private dialog = inject(AdminDialog);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  protected perms = inject(PermissionsService);

  protected readonly id = this.route.snapshot.paramMap.get('id');
  protected readonly isEdit = !!this.id;

  protected readonly statusLabels = PRODUCT_STATUS_LABELS;
  protected readonly statusTone = PRODUCT_STATUS_TONE;

  protected state = signal<LoadState>('loading');
  protected errorMsg = signal('');
  protected submitting = signal(false);
  protected submittingReview = signal(false);
  protected reopening = signal(false);
  protected categories = signal<AdminCategory[]>([]);
  protected product = signal<AdminProduct | null>(null);
  private saved = signal(false);
  private slugTouched = false;

  /** Contenido bloqueado: existe el producto, no soy admin, y el status actual no es DRAFT/REJECTED. */
  protected contentLocked = computed(() => {
    const p = this.product();
    if (!p) return false;
    if (this.perms.role() === 'administrador') return false;
    return !isContentEditableStatus(p.status);
  });

  /** "Enviar a revisión": solo sobre un producto ya existente en DRAFT/REJECTED. */
  protected canSubmitReview = computed(() => {
    const p = this.product();
    return !!p && isContentEditableStatus(p.status) && this.perms.can('products.submitReview');
  });

  /** "Edición controlada": reabre un PUBLISHED hacia DRAFT antes de poder tocar contenido. */
  protected canReopen = computed(() => {
    const p = this.product();
    return !!p && p.status === 'PUBLISHED' && this.perms.can('products.submitReview');
  });

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
      validators: [Validators.min(0)],
    }),
    stock: new FormControl<number>(0, {
      nonNullable: true,
      validators: [Validators.min(0)],
    }),
    categories: new FormControl<string[]>([], { nonNullable: true }),
    images: new FormArray<ReturnType<typeof imageGroup>>([]),
    variants: new FormArray<ReturnType<typeof variantGroup>>([]),
  });

  protected get images(): FormArray<ReturnType<typeof imageGroup>> {
    return this.form.controls.images;
  }

  protected get variants(): FormArray<ReturnType<typeof variantGroup>> {
    return this.form.controls.variants;
  }

  /**
   * NO es un `computed()`: el largo del FormArray no es una signal, así que un
   * `computed` lo cachearía una sola vez y nunca se refrescaría al
   * añadir/quitar variantes. Se llama directo desde la plantilla (OnPush igual
   * revisa la vista tras el evento (click) que dispara `addVariant`/`removeVariant`,
   * porque el evento se originó en la propia plantilla de este componente).
   */
  protected hasVariants(): boolean {
    return this.variants.length > 0;
  }

  protected variantsStockTotal(): number {
    return this.variants.controls.reduce((sum, g) => sum + (Number(g.controls.stock.value) || 0), 0);
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
          this.applyProduct(res.product);
        }
        this.form.markAsPristine();
        this.state.set('ready');
      });
  }

  private applyProduct(p: AdminProduct): void {
    this.product.set(p);
    this.slugTouched = true;
    this.form.patchValue({
      name: p.name,
      slug: p.slug,
      description: p.description ?? '',
      price: p.price,
      stock: p.stock,
      categories: categoryIds(p.categories),
    });
    this.images.clear();
    for (const img of p.images ?? []) this.images.push(imageGroup(img));
    this.variants.clear();
    for (const v of p.variants ?? []) this.variants.push(variantGroup(v));

    if (this.contentLockedFor(p)) {
      this.form.disable({ emitEvent: false });
    } else {
      this.form.enable({ emitEvent: false });
    }
  }

  private contentLockedFor(p: AdminProduct): boolean {
    if (this.perms.role() === 'administrador') return false;
    return !isContentEditableStatus(p.status);
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

  protected isCategorySelected(id: string): boolean {
    return this.form.controls.categories.value.includes(id);
  }

  protected toggleCategory(id: string): void {
    const current = this.form.controls.categories.value;
    const next = current.includes(id) ? current.filter((c) => c !== id) : [...current, id];
    this.form.controls.categories.setValue(next);
    this.form.controls.categories.markAsDirty();
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

  addVariant(): void {
    this.variants.push(variantGroup());
    this.variants.markAsDirty();
  }

  removeVariant(index: number): void {
    this.variants.removeAt(index);
    this.variants.markAsDirty();
  }

  hasUnsavedChanges(): boolean {
    return this.form.dirty && !this.saved();
  }

  private buildPayload(): ProductPayload {
    const v = this.form.getRawValue();

    const images: ProductImage[] = v.images
      .filter((img) => img.url.trim().length > 0)
      .map((img) => ({ url: img.url.trim(), isMain: img.isMain }));
    if (images.length && !images.some((img) => img.isMain)) {
      images[0].isMain = true;
    }

    const variants: ProductVariant[] = v.variants.map((variant) => ({
      sku: variant.sku.trim(),
      color: variant.color.trim(),
      size: variant.size.trim(),
      stock: Number(variant.stock) || 0,
    }));

    return {
      name: v.name.trim(),
      slug: v.slug.trim(),
      description: v.description.trim(),
      price: Number(v.price) || 0,
      stock: Number(v.stock) || 0,
      categories: v.categories,
      images,
      variants,
    };
  }

  /** "Guardar borrador": validación laxa (solo lo que exige el schema siempre: nombre + slug). */
  saveDraft(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const payload = this.buildPayload();

    this.submitting.set(true);
    const req$ = this.isEdit ? this.api.update(this.id!, payload) : this.api.create(payload);

    req$.subscribe({
      next: (saved) => {
        this.submitting.set(false);
        this.saved.set(true);
        this.form.markAsPristine();
        this.dialog.success(this.isEdit ? 'Borrador guardado.' : 'Producto creado como borrador.');
        if (this.isEdit) {
          this.applyProduct(saved);
          this.saved.set(false); // ya se aplicó; permite seguir editando sin bloquear el guard
        } else {
          this.router.navigate(['/admin/products', saved._id, 'edit']);
        }
      },
      error: (err) => {
        this.submitting.set(false);
        this.dialog.error(normalizeError(err).message);
      },
    });
  }

  /** "Enviar a revisión": guarda el borrador y, si acepta, transiciona a PENDING_REVIEW. */
  submitForReview(): void {
    if (!this.isEdit || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const payload = this.buildPayload();
    this.submittingReview.set(true);

    this.api.update(this.id!, payload).subscribe({
      next: () => {
        this.api.updateStatus(this.id!, 'PENDING_REVIEW').subscribe({
          next: (updated) => {
            this.submittingReview.set(false);
            this.saved.set(true);
            this.applyProduct(updated);
            this.dialog.success('Producto enviado a revisión.');
          },
          error: (err) => {
            this.submittingReview.set(false);
            this.showReviewError(err);
          },
        });
      },
      error: (err) => {
        this.submittingReview.set(false);
        this.dialog.error(normalizeError(err).message);
      },
    });
  }

  /** "Edición controlada": PUBLISHED -> DRAFT, para poder volver a tocar contenido. */
  reopenForEditing(): void {
    if (!this.isEdit) return;
    this.reopening.set(true);
    this.api.updateStatus(this.id!, 'DRAFT').subscribe({
      next: (updated) => {
        this.reopening.set(false);
        this.applyProduct(updated);
        this.dialog.success('Producto de vuelta en borrador. Ya puedes editarlo.');
      },
      error: (err) => {
        this.reopening.set(false);
        this.dialog.error(normalizeError(err).message);
      },
    });
  }

  private showReviewError(err: unknown): void {
    if (err instanceof HttpErrorResponse && Array.isArray(err.error?.errors) && err.error.errors.length) {
      this.dialog.error((err.error.errors as string[]).join(' · '));
      return;
    }
    this.dialog.error(normalizeError(err).message);
  }

  ctrl(name: 'name' | 'slug' | 'description' | 'price' | 'stock') {
    return this.form.controls[name];
  }
}
