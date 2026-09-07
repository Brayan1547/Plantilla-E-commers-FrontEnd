import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  FormControl,
  FormGroup,
  FormArray,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { catchError, forkJoin, of, switchMap } from 'rxjs';

import { AdminProductsApi, type ProductPayload } from '../../core/services/admin-products.api';
import { AdminCategoriesApi } from '../../core/services/admin-categories.api';
import { AdminDialog } from '../../core/services/admin-dialog';
import { PermissionsService } from '../../core/services/permissions';
import { normalizeError } from '../../core/services/api-error';
import type { HasUnsavedChanges } from '../../core/guards/unsaved-changes.guard';
import {
  actorName,
  categoryIds,
  formatHeightCm,
  isContentEditableStatus,
  lastReviewComment,
  workflowActionLabel,
  PRODUCT_STATUS_LABELS,
  PRODUCT_STATUS_TONE,
  type AdminCategory,
  type AdminProduct,
  type LoadState,
  type ProductImage,
  type ProductImageType,
  type ProductVariant,
  type WorkflowHistoryEntry,
} from '../../core/models/admin.models';

import { PageHeaderComponent } from '../../shared/ui/page-header/page-header';
import { IconComponent } from '../../shared/ui/icon/icon';
import { SkeletonComponent } from '../../shared/ui/states/skeleton';
import { ErrorStateComponent } from '../../shared/ui/states/error-state';
import { StatusBadgeComponent } from '../../shared/ui/status-badge/status-badge';
import { slugify } from '../../shared/util/format.util';

const SLUG_PATTERN = /^[a-z0-9-]+$/;

// FASE 4 — mismos límites que el backend (`imageUpload.helper.js`). Se
// validan aquí SOLO por UX (feedback inmediato); el backend es la autoridad
// real y los vuelve a exigir siempre (ver F4 report §"Seguridad").
const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_FILE_SIZE_BYTES = 8 * 1024 * 1024;
export const MAX_PRODUCT_IMAGES = 10;

/** `null` si el archivo pasa la validación de UX; el mensaje a mostrar si no. */
function validateImageFileClientSide(file: File): string | null {
  if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.type)) {
    return 'Tipo de archivo no permitido. Usa JPEG, PNG o WEBP.';
  }
  if (file.size > MAX_IMAGE_FILE_SIZE_BYTES) {
    return `El archivo supera el tamaño máximo permitido (${MAX_IMAGE_FILE_SIZE_BYTES / (1024 * 1024)} MB).`;
  }
  return null;
}

interface PendingUpload {
  key: string;
  name: string;
  status: 'uploading' | 'error';
  message?: string;
}

function imageGroup(img?: ProductImage) {
  return new FormGroup({
    // FASE 4 — `_id` real del subdocumento persistido (vacío en una entrada
    // local recién añadida por URL manual, aún no guardada). Distingue una
    // imagen YA PERSISTIDA (borrar = DELETE real al backend + Cloudinary) de
    // una entrada local todavía no guardada (quitar = solo del formulario).
    _id: new FormControl(img?._id ?? '', { nonNullable: true }),
    url: new FormControl(img?.url ?? '', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    isMain: new FormControl(img?.isMain ?? false, { nonNullable: true }),
    // Las NO-principales usan 'MODEL'/'DETAIL'; la principal se fuerza a 'MAIN'
    // en `buildPayload` y el backend la normaliza igual.
    type: new FormControl<ProductImageType>(img?.type ?? 'DETAIL', { nonNullable: true }),
    order: new FormControl<number>(img?.order ?? 0, { nonNullable: true }),
    alt: new FormControl(img?.alt ?? '', { nonNullable: true }),
  });
}

// FASE 5 — el backend exige stock de variante ENTERO (`Number.isInteger`,
// mismo patrón que `stockOps.qty`). Este validador es solo UX: el backend
// sigue siendo la autoridad real (rechaza con 400 igual si se le cuela un
// decimal por otra vía).
function integerValidator(control: { value: unknown }): Record<string, true> | null {
  const value = control.value;
  if (value === null || value === undefined || value === '') return null;
  return Number.isInteger(Number(value)) ? null : { integer: true };
}

// F5-CLOSURE — el backend exige talla NO VACÍA (ni solo espacios) para toda
// variante nueva/actualizada; "Única" es el valor convencional para productos
// sin tallaje (no un campo booleano nuevo). Validador solo de UX: el backend
// sigue siendo la autoridad real y rechaza igual si esto no lo detecta.
function requiredNonBlankValidator(control: { value: unknown }): Record<string, true> | null {
  const value = control.value;
  return typeof value === 'string' && value.trim().length > 0 ? null : { required: true };
}

function variantGroup(v?: ProductVariant) {
  return new FormGroup({
    sku: new FormControl(v?.sku ?? '', { nonNullable: true }),
    color: new FormControl(v?.color ?? '', { nonNullable: true }),
    // F5-CLOSURE — una variante NUEVA (sin `v`, ver `addVariant()`) nace con
    // "Única" en vez de vacía. Una variante YA PERSISTIDA conserva lo que
    // trae el servidor tal cual (incluida una talla vacía legada — se
    // detecta como error hasta que el editor la corrija; ver F5-CLOSURE
    // report §Productos legacy).
    size: new FormControl(v?.size ?? 'Única', {
      nonNullable: true,
      validators: [requiredNonBlankValidator],
    }),
    stock: new FormControl<number>(v?.stock ?? 0, {
      nonNullable: true,
      validators: [Validators.min(0), integerValidator],
    }),
  });
}

@Component({
  selector: 'adm-product-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    DatePipe,
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
  protected readonly formatHeight = formatHeightCm;
  protected readonly actionLabel = workflowActionLabel;

  protected state = signal<LoadState>('loading');
  protected errorMsg = signal('');
  protected submitting = signal(false);
  protected submittingReview = signal(false);
  protected reopening = signal(false);
  protected categories = signal<AdminCategory[]>([]);
  protected product = signal<AdminProduct | null>(null);
  /**
   * 409 durante una acción de workflow: el producto cambió de estado en el
   * servidor. NO se recarga automáticamente (perdería cambios locales sin
   * avisar) — se muestra un banner persistente hasta que el usuario pida
   * recargar explícitamente. Ver F3-CLOSURE §5/§6.
   */
  protected conflict = signal(false);
  private saved = signal(false);
  private slugTouched = false;

  // FASE 4 — estado transitorio del upload real (Cloudinary vía backend).
  // NUNCA se confunde con el estado del FormArray `images`: una imagen recién
  // subida ya está PERSISTIDA (el backend la guardó con `$push` atómico) y
  // aparece de inmediato en `images` vía `mergeImagesFromServer`; lo que vive
  // aquí es solo el progreso/errores de archivos EN VUELO o que fallaron.
  protected pendingUploads = signal<PendingUpload[]>([]);
  protected deletingImageIds = signal<Set<string>>(new Set());
  protected readonly maxProductImages = MAX_PRODUCT_IMAGES;

  /** Contenido bloqueado: existe el producto, no soy admin, y el status actual no es editable. */
  protected contentLocked = computed(() => {
    const p = this.product();
    if (!p) return false;
    if (this.perms.role() === 'administrador') return false;
    return !isContentEditableStatus(p.status);
  });

  /** "Enviar a revisión": sobre un producto existente en DRAFT/REJECTED/CHANGES_REQUESTED. */
  protected canSubmitReview = computed(() => {
    const p = this.product();
    return !!p && isContentEditableStatus(p.status) && this.perms.can('products.submitReview');
  });

  // --- F6 — Admin Review: acciones de transición sobre el detalle completo -----
  // Mismas reglas que `product-list.page.ts` (misma máquina de estados,
  // `canTransitionProduct` en el backend); se repiten aquí porque el
  // administrador revisa el detalle COMPLETO (imágenes/variantes/historial)
  // desde esta página, no solo desde la fila de la lista.
  protected canApproveReview = computed(() => {
    const p = this.product();
    return !!p && p.status === 'PENDING_REVIEW' && this.perms.can('products.approve');
  });
  protected canRequestChangesReview = computed(() => {
    const p = this.product();
    return !!p && p.status === 'PENDING_REVIEW' && this.perms.can('products.requestChanges');
  });
  protected canRejectReview = computed(() => {
    const p = this.product();
    return !!p && p.status === 'PENDING_REVIEW' && this.perms.can('products.reject');
  });
  protected canPublishReview = computed(() => {
    const p = this.product();
    return !!p && p.status === 'APPROVED' && this.perms.can('products.publish');
  });
  /** Bloquea los 4 botones de arriba mientras hay una transición en vuelo. */
  protected reviewActionBusy = signal(false);

  /**
   * "Edición controlada": reabre un PUBLISHED hacia DRAFT antes de poder tocar
   * contenido. F3-CLOSURE: para el rol `editor`, PUBLISHED es SOLO LECTURA en
   * la UI — no se ofrece reapertura, aunque el backend conserve la transición
   * `PUBLISHED -> DRAFT` para el propietario (no se toca la máquina de estados
   * backend, solo se deja de exponer la acción en el editor). shop_manager y
   * administrador conservan la capacidad sin cambios.
   */
  protected canReopen = computed(() => {
    const p = this.product();
    if (!p || p.status !== 'PUBLISHED') return false;
    if (this.perms.role() === 'editor') return false;
    return this.perms.can('products.submitReview');
  });

  /** Etiqueta del botón de envío según el estado (DRAFT = "Enviar", el resto = "Reenviar"). */
  protected submitLabel = computed(() => (this.product()?.status === 'DRAFT' ? 'Enviar a revisión' : 'Reenviar a revisión'));

  /** Comentario de la última revisión (CHANGES_REQUESTED / REJECTED). */
  protected reviewComment = computed(() => {
    const p = this.product();
    return p ? lastReviewComment(p) : null;
  });

  /** Historial de workflow, más reciente primero. */
  protected history = computed<WorkflowHistoryEntry[]>(() => {
    const h = this.product()?.workflowHistory ?? [];
    return [...h].reverse();
  });
  protected showHistory = signal(false);

  /** F6 — nombre de quien ejecutó una entrada del historial (`by` populado por el backend). */
  protected historyActorName(entry: WorkflowHistoryEntry): string | null {
    return actorName(entry.by);
  }

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
    // FASE 1 del backend — contenido editorial. Opcional para DRAFT; obligatorio
    // para enviar a revisión (`collectSubmitBlockers` lo advierte; el backend lo exige).
    details: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(2000)] }),
    shippingInfo: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(2000)] }),
    returnsInfo: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(2000)] }),
    modelInfo: new FormGroup({
      size: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(20)] }),
      heightCm: new FormControl<number | null>(null, { validators: [Validators.min(50), Validators.max(260)] }),
    }),
  });

  protected get images(): FormArray<ReturnType<typeof imageGroup>> {
    return this.form.controls.images;
  }

  protected get variants(): FormArray<ReturnType<typeof variantGroup>> {
    return this.form.controls.variants;
  }

  /**
   * NO es un `computed()`: el largo del FormArray no es una signal.
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
      details: p.details ?? '',
      shippingInfo: p.shippingInfo ?? '',
      returnsInfo: p.returnsInfo ?? '',
      modelInfo: {
        size: p.modelInfo?.size ?? '',
        heightCm: p.modelInfo?.heightCm ?? null,
      },
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

  /**
   * FASE 4 — Selección de archivos desde el input `<input type="file">`.
   * Cada archivo sube de forma INDEPENDIENTE (upload real, backend ->
   * Cloudinary): así un archivo inválido/fallido no bloquea a los demás, y
   * cada uno tiene su propio estado de progreso/error.
   */
  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    input.value = ''; // permite volver a seleccionar el mismo archivo despues
    for (const file of files) this.uploadOneFile(file);
  }

  /**
   * FASE 4-CLOSURE §3 — Cuenta "efectiva" de imágenes: las ya persistidas
   * (`images.length`) MÁS las que están subiendo AHORA MISMO en este mismo
   * lote (`pendingUploads` con status 'uploading'). `onFilesSelected` llama a
   * `uploadOneFile` en un bucle síncrono; como cada llamada AÑADE su entrada
   * a `pendingUploads` de forma síncrona ANTES del `await` de red, el archivo
   * #2 del mismo lote YA ve reservado el cupo que acaba de tomar el #1 —
   * aunque su respuesta HTTP todavía no haya vuelto. Sin esto, seleccionar
   * más archivos que cupos libres podía disparar más uploads concurrentes de
   * los que el límite permite (el backend los rechaza igual — ver
   * `dbAddProductImage` — pero aquí se evita gastar la solicitud).
   */
  private effectiveImageCount(): number {
    return this.images.length + this.pendingUploads().filter((u) => u.status === 'uploading').length;
  }

  private uploadOneFile(file: File): void {
    const key = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    if (!this.isEdit || !this.id) {
      this.pendingUploads.update((list) => [
        ...list,
        { key, name: file.name, status: 'error', message: 'Guarda el producto como borrador antes de subir imágenes.' },
      ]);
      return;
    }
    if (this.effectiveImageCount() >= MAX_PRODUCT_IMAGES) {
      this.pendingUploads.update((list) => [
        ...list,
        { key, name: file.name, status: 'error', message: `Se alcanzó el máximo de imágenes por producto (${MAX_PRODUCT_IMAGES}).` },
      ]);
      return;
    }
    const clientError = validateImageFileClientSide(file);
    if (clientError) {
      this.pendingUploads.update((list) => [...list, { key, name: file.name, status: 'error', message: clientError }]);
      return;
    }

    // Se registra como 'uploading' ANTES de llamar al backend (síncrono):
    // así el siguiente archivo del mismo lote, procesado a continuación en
    // el mismo bucle síncrono de `onFilesSelected`, ve este cupo ya tomado.
    this.pendingUploads.update((list) => [...list, { key, name: file.name, status: 'uploading' }]);
    this.api.uploadImage(this.id!, file).subscribe({
      next: (updated) => {
        this.pendingUploads.update((list) => list.filter((u) => u.key !== key));
        this.mergeImagesFromServer(updated);
      },
      error: (err) => {
        const message = normalizeError(err).message;
        this.pendingUploads.update((list) => list.map((u) => (u.key === key ? { ...u, status: 'error', message } : u)));
      },
    });
  }

  dismissPendingUpload(key: string): void {
    this.pendingUploads.update((list) => list.filter((u) => u.key !== key));
  }

  /**
   * FASE 4-CLOSURE §1 — Mezcla lo que devolvió el backend (upload/delete YA
   * persistidos) con el FORMULARIO ACTUAL, en vez de reconstruirlo desde
   * cero. `images.clear()` + repoblar perdía CUALQUIER edición local todavía
   * no guardada (alt/tipo/principal/orden) apenas terminaba un upload o un
   * borrado — inaceptable (ver hallazgo de la auditoría externa).
   *
   * Regla de mezcla, por imagen ya persistida (`_id` coincide en ambos lados):
   *   - un control que el usuario YA TOCÓ localmente (`.dirty`) CONSERVA su
   *     valor local — el servidor no lo pisa;
   *   - un control SIN tocar (`pristine`) se sincroniza con el valor real del
   *     servidor (p. ej. `isMain` tras la promoción automática de un borrado).
   * El ORDEN del array (posición) es SIEMPRE el local — nunca se reordena a
   * como vino el servidor — para no deshacer un `moveImage()` pendiente.
   * Imágenes que el servidor ya no tiene (se borraron) se quitan. Imágenes
   * nuevas que el formulario todavía no conoce (la que se acaba de subir) se
   * añaden al final.
   */
  private mergeImagesFromServer(updated: AdminProduct): void {
    const serverImages = updated.images ?? [];
    const serverById = new Map(serverImages.filter((img) => img._id).map((img) => [img._id!, img]));

    for (let i = this.images.length - 1; i >= 0; i--) {
      const localId = this.images.at(i).controls._id.value;
      if (localId && !serverById.has(localId)) {
        this.images.removeAt(i);
      }
    }

    // `isMain` es EXCLUSIVO (una sola imagen puede serlo): si el usuario ya
    // eligió una principal localmente (algún control `isMain` dirty en
    // `true`), esa elección gobierna el array COMPLETO — se ignora el
    // `isMain`/`type` del servidor para TODAS las imágenes, no solo para la
    // que el usuario tocó. Sin esto, sincronizar solo el control dirty podía
    // dejar DOS imágenes marcadas como principal a la vez (la elegida
    // localmente + la que el servidor promovió en un borrado que no sabía
    // nada del cambio local).
    const hasLocalMainOverride = this.images.controls.some(
      (g) => g.controls.isMain.dirty && g.controls.isMain.value === true,
    );

    for (const group of this.images.controls) {
      const localId = group.controls._id.value;
      if (!localId) continue; // entrada local sin persistir (URL manual): no se toca
      const server = serverById.get(localId);
      if (!server) continue;
      if (!group.controls.url.dirty) group.controls.url.setValue(server.url ?? '', { emitEvent: false });
      if (!hasLocalMainOverride) {
        if (!group.controls.isMain.dirty) group.controls.isMain.setValue(server.isMain ?? false, { emitEvent: false });
        if (!group.controls.type.dirty) group.controls.type.setValue(server.type ?? 'DETAIL', { emitEvent: false });
      }
      if (!group.controls.alt.dirty) group.controls.alt.setValue(server.alt ?? '', { emitEvent: false });
    }

    const localIds = new Set(this.images.controls.map((g) => g.controls._id.value).filter(Boolean));
    for (const server of serverImages) {
      if (server._id && !localIds.has(server._id)) {
        this.images.push(imageGroup(server));
      }
    }

    const current = this.product();
    if (current) this.product.set({ ...current, images: updated.images });
  }

  /**
   * Quita una imagen. Si YA está persistida (`_id` real, ver `imageGroup`),
   * dispara el DELETE real al backend (borra también en Cloudinary,
   * best-effort) — nunca queda mostrada como "eliminada" hasta que el
   * servidor lo confirma. Si es una entrada LOCAL (URL pegada a mano, sin
   * `_id`, aún no guardada), se quita solo del formulario, como antes.
   */
  removeImage(index: number): void {
    const group = this.images.at(index);
    const imageId = group.controls._id.value;
    const wasMain = group.controls.isMain.value;

    if (!imageId || !this.isEdit || !this.id) {
      this.images.removeAt(index);
      if (wasMain && this.images.length) this.setMain(0);
      this.images.markAsDirty();
      return;
    }

    this.deletingImageIds.update((s) => new Set(s).add(imageId));
    this.api.deleteImage(this.id, imageId).subscribe({
      next: (updated) => {
        this.deletingImageIds.update((s) => {
          const next = new Set(s);
          next.delete(imageId);
          return next;
        });
        this.mergeImagesFromServer(updated);
      },
      error: (err) => {
        this.deletingImageIds.update((s) => {
          const next = new Set(s);
          next.delete(imageId);
          return next;
        });
        this.dialog.error(normalizeError(err).message);
      },
    });
  }

  /**
   * FASE 4-CLOSURE §1 — `setValue()` programático NO marca el control como
   * `.dirty` por sí solo (Angular solo lo hace ante interacción real del
   * usuario vía `formControlName`). Se marca aquí explícitamente CADA
   * control que de verdad cambia, para que `mergeImagesFromServer` pueda
   * distinguir "el usuario ya eligió una principal localmente" (se conserva)
   * de "sigue como venía del servidor" (se sincroniza).
   */
  setMain(index: number): void {
    this.images.controls.forEach((g, i) => {
      const isMain = i === index;
      if (g.controls.isMain.value !== isMain) {
        g.controls.isMain.setValue(isMain);
        g.controls.isMain.markAsDirty();
      }
      if (isMain) {
        if (g.controls.type.value !== 'MAIN') {
          g.controls.type.setValue('MAIN');
          g.controls.type.markAsDirty();
        }
      } else if (g.controls.type.value === 'MAIN') {
        g.controls.type.setValue('DETAIL');
        g.controls.type.markAsDirty();
      }
    });
    this.images.markAsDirty();
  }

  moveImage(index: number, dir: -1 | 1): void {
    const target = index + dir;
    if (target < 0 || target >= this.images.length) return;
    const ctrl = this.images.at(index);
    this.images.removeAt(index);
    this.images.insert(target, ctrl);
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
      .map((img, i) => ({
        // FASE 4 — se reenvía el `_id` cuando ya existe (imagen persistida):
        // el backend reconcilia `publicId` por URL, así que esto no es
        // estrictamente necesario para eso, pero conserva la identidad del
        // subdocumento en vez de recrearlo en cada guardado.
        ...(img._id ? { _id: img._id } : {}),
        url: img.url.trim(),
        isMain: img.isMain,
        type: img.isMain ? 'MAIN' : img.type === 'MAIN' ? 'DETAIL' : img.type,
        order: i,
        alt: img.alt.trim(),
      }));
    if (images.length && !images.some((img) => img.isMain)) {
      images[0].isMain = true;
      images[0].type = 'MAIN';
    }

    const variants: ProductVariant[] = v.variants.map((variant) => ({
      sku: variant.sku.trim(),
      color: variant.color.trim(),
      size: variant.size.trim(),
      stock: Number(variant.stock) || 0,
    }));

    const heightRaw = v.modelInfo.heightCm;
    const heightValid = heightRaw != null && Number.isFinite(Number(heightRaw)) && Number(heightRaw) > 0;
    const modelInfo = {
      size: v.modelInfo.size.trim(),
      ...(heightValid ? { heightCm: Math.round(Number(heightRaw)) } : {}),
    };

    return {
      name: v.name.trim(),
      slug: v.slug.trim(),
      description: v.description.trim(),
      price: Number(v.price) || 0,
      stock: Number(v.stock) || 0,
      categories: v.categories,
      images,
      variants,
      details: v.details.trim(),
      shippingInfo: v.shippingInfo.trim(),
      returnsInfo: v.returnsInfo.trim(),
      modelInfo,
    };
  }

  /**
   * Réplica (best-effort, para UX) de `collectSubmitReviewErrors` del backend.
   * El backend sigue siendo la autoridad — si esto no detecta algo, el 400 con
   * `errors[]` del backend se muestra igual (`handleWorkflowError`).
   */
  protected collectSubmitBlockers(): string[] {
    const v = this.form.getRawValue();
    const b: string[] = [];
    if (!v.name.trim() || v.name.trim().length < 2) b.push('El nombre es obligatorio (mínimo 2 caracteres).');
    if (!v.slug.trim()) b.push('El slug es obligatorio.');
    if (!v.description.trim()) b.push('La descripción es obligatoria.');
    if (!v.categories.length) b.push('Debe asignar al menos una categoría.');
    if (!(Number(v.price) > 0)) b.push('El precio debe ser mayor que 0.');
    if (!v.details.trim()) b.push('Los detalles del producto son obligatorios.');
    if (!v.shippingInfo.trim()) b.push('La información de envíos es obligatoria.');
    if (!v.returnsInfo.trim()) b.push('La información de cambios y devoluciones es obligatoria.');
    if (!v.images.some((i) => i.url.trim())) b.push('Debe cargar al menos una imagen.');

    // FASE 5 — mismas reglas que el backend (`product.services.js`):
    // SKU único dentro del producto y combinación color+talla única (talla
    // vacía cuenta como valor comparable — accesorios sin talla). Solo UX:
    // el backend sigue siendo la autoridad real y rechaza igual si esto no
    // lo detecta (p. ej. duplicado contra OTRO producto, que aquí no se
    // puede saber sin una consulta al servidor).
    const seenSkus = new Map<string, number>();
    const seenCombos = new Map<string, number>();
    v.variants.forEach((vv, i) => {
      if (!vv.sku.trim()) b.push(`La variante #${i + 1} necesita un SKU.`);
      if (!vv.color.trim()) b.push(`La variante #${i + 1} necesita un color.`);
      // F5-CLOSURE — talla obligatoria (usa "Única" si el producto no tiene
      // tallaje). Réplica de UX del validador de schema del backend.
      if (!vv.size.trim()) b.push(`La variante #${i + 1} necesita una talla (usa "Única" si no aplica).`);
      if (!Number.isInteger(Number(vv.stock))) b.push(`La variante #${i + 1} necesita un stock entero.`);

      const normSku = vv.sku.trim().toLowerCase();
      if (normSku) {
        if (seenSkus.has(normSku)) {
          b.push(`Las variantes #${seenSkus.get(normSku)! + 1} y #${i + 1} tienen el mismo SKU.`);
        } else {
          seenSkus.set(normSku, i);
        }
      }

      const combo = `${vv.color.trim().toLowerCase()}::${vv.size.trim().toLowerCase()}`;
      if (seenCombos.has(combo)) {
        b.push(`Las variantes #${seenCombos.get(combo)! + 1} y #${i + 1} tienen el mismo color y talla.`);
      } else {
        seenCombos.set(combo, i);
      }
    });
    return b;
  }

  /** "Guardar borrador": validación laxa (solo lo que exige el schema siempre: nombre + slug). */
  saveDraft(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const payload = this.buildPayload();

    this.conflict.set(false);
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
          this.saved.set(false);
        } else {
          this.router.navigate(['/admin/products', saved._id, 'edit']);
        }
      },
      error: (err) => {
        this.submitting.set(false);
        this.handleWorkflowError(err);
      },
    });
  }

  /**
   * "Enviar / reenviar a revisión": guarda el contenido y transiciona a
   * PENDING_REVIEW. `submitToReview` encapsula la diferencia de contrato:
   *   DRAFT / CHANGES_REQUESTED -> PENDING_REVIEW directo;
   *   REJECTED -> DRAFT -> PENDING_REVIEW (el backend no tiene la arista directa).
   */
  submitForReview(): void {
    const p = this.product();
    if (!this.isEdit || !p) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
    }
    const blockers = this.collectSubmitBlockers();
    if (blockers.length) {
      this.dialog.error('Faltan datos para enviar a revisión: ' + blockers.join(' · '));
      this.form.markAllAsTouched();
      return;
    }
    const payload = this.buildPayload();
    this.conflict.set(false);
    this.submittingReview.set(true);

    this.api
      .update(this.id!, payload)
      .pipe(switchMap(() => this.api.submitToReview(this.id!, p.status)))
      .subscribe({
        next: (updated) => {
          this.submittingReview.set(false);
          this.saved.set(true);
          this.applyProduct(updated);
          this.dialog.success('Producto enviado a revisión.');
        },
        error: (err) => {
          this.submittingReview.set(false);
          this.handleWorkflowError(err);
        },
      });
  }

  /** "Edición controlada": PUBLISHED -> DRAFT, para poder volver a tocar contenido. */
  reopenForEditing(): void {
    if (!this.isEdit) return;
    this.conflict.set(false);
    this.reopening.set(true);
    this.api.updateStatus(this.id!, 'DRAFT').subscribe({
      next: (updated) => {
        this.reopening.set(false);
        this.applyProduct(updated);
        this.dialog.success('Producto de vuelta en borrador. Ya puedes editarlo.');
      },
      error: (err) => {
        this.reopening.set(false);
        this.handleWorkflowError(err);
      },
    });
  }

  /**
   * F6 — transición genérica de revisión (approve/request_changes/reject/
   * publish), todas comparten el mismo endpoint (`PATCH /product/:id/status`,
   * el ÚNICO punto de entrada al workflow — nunca se toca `status` desde
   * ningún otro sitio) y el mismo manejo de éxito/error/409 ya establecido
   * (`applyProduct` + `handleWorkflowError`, F3-CLOSURE §5/§6).
   */
  private reviewTransition(toStatus: 'APPROVED' | 'CHANGES_REQUESTED' | 'REJECTED' | 'PUBLISHED', comment: string | undefined, successMsg: string): void {
    if (!this.isEdit || !this.id) return;
    this.conflict.set(false);
    this.reviewActionBusy.set(true);
    this.api.updateStatus(this.id, toStatus, comment).subscribe({
      next: (updated) => {
        this.reviewActionBusy.set(false);
        this.applyProduct(updated);
        this.dialog.success(successMsg);
      },
      error: (err) => {
        this.reviewActionBusy.set(false);
        this.handleWorkflowError(err);
      },
    });
  }

  /** F6 — "Aprobar": PENDING_REVIEW -> APPROVED. No exige comentario (backend). */
  approveReview(): void {
    this.reviewTransition('APPROVED', undefined, 'Producto aprobado.');
  }

  /** F6 — "Solicitar cambios": PENDING_REVIEW -> CHANGES_REQUESTED. Comentario obligatorio (queda en workflowHistory). */
  async requestChangesReview(): Promise<void> {
    const p = this.product();
    if (!p) return;
    const comment = await this.dialog.promptText({
      title: `Solicitar cambios en "${p.name}"`,
      message: 'Explica qué debe corregir el editor antes de reenviar.',
      placeholder: 'Cambios solicitados…',
      confirmText: 'Solicitar cambios',
    });
    if (!comment) return;
    this.reviewTransition('CHANGES_REQUESTED', comment, 'Cambios solicitados. El editor podrá verlos y corregir.');
  }

  /** F6 — "Rechazar": PENDING_REVIEW -> REJECTED. Motivo obligatorio (queda en workflowHistory + rejectionReason). */
  async rejectReview(): Promise<void> {
    const p = this.product();
    if (!p) return;
    const comment = await this.dialog.promptText({
      title: `Rechazar "${p.name}"`,
      message: 'Indica el motivo del rechazo. El editor lo verá para corregir y reenviar.',
      placeholder: 'Motivo del rechazo…',
      confirmText: 'Rechazar',
    });
    if (!comment) return;
    this.reviewTransition('REJECTED', comment, 'Producto rechazado.');
  }

  /** F6 — "Publicar": APPROVED -> PUBLISHED (mecanismo ya existente en `product-list.page`; no es F7). */
  publishReview(): void {
    this.reviewTransition('PUBLISHED', undefined, 'Producto publicado.');
  }

  /**
   * Manejo de error unificado para las acciones de workflow.
   *  - 409 (el producto cambió de estado en el servidor mientras se editaba):
   *    NUNCA se recarga automáticamente ni se descartan cambios locales en
   *    silencio. Se activa el banner persistente (`conflict`) con una acción
   *    explícita de "Recargar" — el usuario decide. Ver F3-CLOSURE §5/§6.
   *  - 400 con `errors[]` (validación de submit del backend) -> se listan.
   *  - resto -> mensaje normalizado vía toast.
   */
  private handleWorkflowError(err: unknown): void {
    const n = normalizeError(err);
    if (n.status === 409) {
      this.conflict.set(true);
      return;
    }
    if (err instanceof HttpErrorResponse && Array.isArray(err.error?.errors) && err.error.errors.length) {
      this.dialog.error((err.error.errors as string[]).join(' · '));
    } else {
      this.dialog.error(n.message);
    }
  }

  /**
   * Acción explícita del banner de conflicto (409): recién ahora se pide el
   * producto real y se reemplaza el formulario. Antes de esto, los datos
   * locales del usuario permanecen intactos.
   */
  reloadAfterConflict(): void {
    this.conflict.set(false);
    this.load();
  }

  ctrl(name: 'name' | 'slug' | 'description' | 'price' | 'stock' | 'details' | 'shippingInfo' | 'returnsInfo') {
    return this.form.controls[name];
  }
}
