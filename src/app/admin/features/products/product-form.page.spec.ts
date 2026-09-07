import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { vi } from 'vitest';

import ProductFormPage from './product-form.page';
import { PermissionsService } from '../../core/services/permissions';
import { AdminDialog } from '../../core/services/admin-dialog';
import type { Permission } from '../../core/models/permission.model';
import type { AdminProduct } from '../../core/models/admin.models';

/**
 * FASE 3 — Product Domain + Editor Workflow.
 *
 * Cubre: guardar borrador con categorías/variantes múltiples, y la regla
 * central de la Decisión funcional §1 — un producto PUBLISHED no se edita
 * directamente salvo que seas administrador (autoridad final).
 */
describe('ProductFormPage (admin)', () => {
  let httpMock: HttpTestingController;

  function fakePermissions(role: string, granted: Permission[]) {
    return {
      role: () => role,
      can: (p: Permission) => granted.includes(p),
      canAny: (ps: readonly Permission[]) => ps.some((p) => granted.includes(p)),
      canAll: (ps: readonly Permission[]) => ps.every((p) => granted.includes(p)),
    };
  }

  function setup(opts: { id?: string; role: string; granted: Permission[] }) {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: PermissionsService, useValue: fakePermissions(opts.role, opts.granted) },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap(opts.id ? { id: opts.id } : {}) } },
        },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(ProductFormPage);
    fixture.detectChanges(); // dispara load()
    return fixture;
  }

  function flushLoad(product: AdminProduct | null) {
    httpMock.expectOne((r) => r.url.endsWith('/category')).flush({
      msg: 'ok',
      data: [{ _id: 'cHombre', name: 'Hombre', slug: 'hombre', isActive: true }],
    });
    if (product) {
      httpMock.expectOne((r) => r.url.endsWith(`/product/${product._id}`)).flush({ msg: 'ok', data: product });
    }
  }

  afterEach(() => httpMock.verify());

  const draftProduct: AdminProduct = {
    _id: 'p1',
    name: 'Draft X',
    slug: 'draft-x',
    description: '',
    price: 0,
    stock: 0,
    isActive: false,
    status: 'DRAFT',
    categories: [],
    images: [],
    variants: [],
  };

  const publishedProduct: AdminProduct = {
    ...draftProduct,
    _id: 'p2',
    slug: 'published-x',
    status: 'PUBLISHED',
    isActive: true,
  };

  /** DRAFT completo: pasa `collectSubmitBlockers` (incluye los 3 campos F1). */
  const readyProduct: AdminProduct = {
    ...draftProduct,
    _id: 'p9',
    slug: 'ready-x',
    description: 'desc',
    price: 1000,
    categories: ['cHombre'],
    images: [{ url: 'http://x/1.png', isMain: true, type: 'MAIN', order: 0, alt: '' }],
    details: 'Composición 100% algodón',
    shippingInfo: 'Envío 2-4 días',
    returnsInfo: 'Cambios 30 días',
    modelInfo: { size: 'S', heightCm: 187 },
  };

  it('crear: guarda borrador con categorías seleccionadas y variantes, y navega a la edición', () => {
    const f = setup({ role: 'editor', granted: ['products.create', 'products.update', 'products.submitReview'] });
    flushLoad(null);
    f.detectChanges();
    const cmp = f.componentInstance as any;
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate');

    cmp.form.patchValue({ name: 'Camiseta X', slug: 'camiseta-x', price: 1000 });
    cmp.toggleCategory('cHombre');
    cmp.addVariant();
    cmp.variants.at(0).patchValue({ sku: 'SKU-1', color: 'Negro', stock: 5 });

    cmp.saveDraft();
    const req = httpMock.expectOne((r) => r.url.endsWith('/product') && r.method === 'POST');
    expect(req.request.body.categories).toEqual(['cHombre']);
    // F5-CLOSURE — una variante NUEVA nace con talla "Única" (nunca vacía).
    expect(req.request.body.variants).toEqual([{ sku: 'SKU-1', color: 'Negro', size: 'Única', stock: 5 }]);
    req.flush({ msg: 'ok', data: { ...draftProduct, _id: 'new-id', categories: ['cHombre'] } });

    expect(router.navigate).toHaveBeenCalledWith(['/admin/products', 'new-id', 'edit']);
  });

  it('editor viendo su DRAFT: formulario habilitado y puede enviar a revisión', () => {
    const f = setup({ id: draftProduct._id, role: 'editor', granted: ['products.update', 'products.submitReview'] });
    flushLoad(draftProduct);
    f.detectChanges();
    const cmp = f.componentInstance as any;

    expect(cmp.contentLocked()).toBe(false);
    expect(cmp.canSubmitReview()).toBe(true);
    expect(cmp.form.disabled).toBe(false);
  });

  it('F3-CLOSURE · editor viendo un PUBLISHED: solo lectura, sin "enviar a revisión" ni reapertura', () => {
    const f = setup({ id: publishedProduct._id, role: 'editor', granted: ['products.update', 'products.submitReview'] });
    flushLoad(publishedProduct);
    f.detectChanges();
    const cmp = f.componentInstance as any;

    expect(cmp.contentLocked()).toBe(true);
    expect(cmp.canSubmitReview()).toBe(false);
    expect(cmp.canReopen()).toBe(false);
    expect(cmp.form.disabled).toBe(true);
    expect(f.nativeElement.textContent).not.toContain('Volver a borrador para editar');
  });

  it('F3-CLOSURE · shop_manager viendo un PUBLISHED: conserva la opción de reabrir (no es el editor)', () => {
    const f = setup({
      id: publishedProduct._id,
      role: 'shop_manager',
      granted: ['products.update', 'products.submitReview'],
    });
    flushLoad(publishedProduct);
    f.detectChanges();
    const cmp = f.componentInstance as any;

    expect(cmp.contentLocked()).toBe(true);
    expect(cmp.canReopen()).toBe(true);
    expect(f.nativeElement.textContent).toContain('Volver a borrador para editar');
  });

  it('administrador viendo un PUBLISHED: NUNCA bloqueado (autoridad final, Decisión §1)', () => {
    const f = setup({ id: publishedProduct._id, role: 'administrador', granted: ['products.update', 'products.submitReview'] });
    flushLoad(publishedProduct);
    f.detectChanges();
    const cmp = f.componentInstance as any;

    expect(cmp.contentLocked()).toBe(false);
    expect(cmp.form.disabled).toBe(false);
  });

  it('shop_manager: "volver a borrador" transiciona PUBLISHED -> DRAFT vía PATCH /status', () => {
    const f = setup({
      id: publishedProduct._id,
      role: 'shop_manager',
      granted: ['products.update', 'products.submitReview'],
    });
    flushLoad(publishedProduct);
    f.detectChanges();
    const cmp = f.componentInstance as any;

    cmp.reopenForEditing();
    const req = httpMock.expectOne((r) => r.url.endsWith(`/product/${publishedProduct._id}/status`));
    expect(req.request.body.toStatus).toBe('DRAFT');
    req.flush({ msg: 'ok', data: { ...publishedProduct, status: 'DRAFT', isActive: false } });

    expect(cmp.contentLocked()).toBe(false);
    expect(cmp.form.disabled).toBe(false);
  });

  // ---- F3 -----------------------------------------------------------------

  it('F3 · editor viendo su CHANGES_REQUESTED: editable, muestra el comentario y puede reenviar', () => {
    const product: AdminProduct = {
      ...readyProduct,
      _id: 'pcr',
      status: 'CHANGES_REQUESTED',
      workflowHistory: [
        { action: 'submit', fromStatus: 'DRAFT', toStatus: 'PENDING_REVIEW', at: '2026-01-01T00:00:00Z' },
        {
          action: 'request_changes',
          fromStatus: 'PENDING_REVIEW',
          toStatus: 'CHANGES_REQUESTED',
          comment: 'Falta la imagen posterior.',
          at: '2026-01-02T00:00:00Z',
        },
      ],
    };
    const f = setup({ id: product._id, role: 'editor', granted: ['products.update', 'products.submitReview'] });
    flushLoad(product);
    f.detectChanges();
    const cmp = f.componentInstance as any;

    expect(cmp.contentLocked()).toBe(false);
    expect(cmp.form.disabled).toBe(false);
    expect(cmp.canSubmitReview()).toBe(true);
    expect(cmp.reviewComment()).toBe('Falta la imagen posterior.');
    expect(cmp.submitLabel()).toBe('Reenviar a revisión');
    expect(f.nativeElement.textContent).toContain('Falta la imagen posterior.');
  });

  it('F3 · editor viendo un ARCHIVED: readonly, sin acciones editoriales', () => {
    const product: AdminProduct = { ...readyProduct, _id: 'parch', status: 'ARCHIVED', isActive: false };
    const f = setup({ id: product._id, role: 'editor', granted: ['products.update', 'products.submitReview'] });
    flushLoad(product);
    f.detectChanges();
    const cmp = f.componentInstance as any;

    expect(cmp.contentLocked()).toBe(true);
    expect(cmp.form.disabled).toBe(true);
    expect(cmp.canSubmitReview()).toBe(false);
    expect(cmp.canReopen()).toBe(false);
  });

  it('F3 · submit incompleto (faltan details/shipping/returns): muestra blockers y NO llama al backend', () => {
    const product: AdminProduct = { ...draftProduct, _id: 'pinc', description: 'd', price: 10, categories: ['cHombre'],
      images: [{ url: 'http://x/1.png', isMain: true }] };
    const f = setup({ id: product._id, role: 'editor', granted: ['products.update', 'products.submitReview'] });
    flushLoad(product);
    f.detectChanges();
    const cmp = f.componentInstance as any;
    const dialog = TestBed.inject(AdminDialog);
    const errSpy = vi.spyOn(dialog, 'error');

    cmp.submitForReview();

    expect(errSpy).toHaveBeenCalled();
    expect(errSpy.mock.calls[0][0]).toContain('detalles');
    httpMock.expectNone((r) => r.url.includes('/product/'));
  });

  it('F3 · reenviar desde CHANGES_REQUESTED: PATCH contenido + PATCH status PENDING_REVIEW (directo)', () => {
    const product: AdminProduct = { ...readyProduct, _id: 'pcr2', status: 'CHANGES_REQUESTED' };
    const f = setup({ id: product._id, role: 'editor', granted: ['products.update', 'products.submitReview'] });
    flushLoad(product);
    f.detectChanges();
    const cmp = f.componentInstance as any;

    cmp.submitForReview();

    const patch = httpMock.expectOne((r) => r.url.endsWith('/product/pcr2') && r.method === 'PATCH');
    patch.flush({ msg: 'ok', data: product });
    const status = httpMock.expectOne((r) => r.url.endsWith('/product/pcr2/status'));
    expect(status.request.body.toStatus).toBe('PENDING_REVIEW');
    status.flush({ msg: 'ok', data: { ...product, status: 'PENDING_REVIEW' } });

    expect(cmp.product().status).toBe('PENDING_REVIEW');
  });

  it('F3 · reenviar desde REJECTED: PATCH contenido + status DRAFT + status PENDING_REVIEW (cadena)', () => {
    const product: AdminProduct = { ...readyProduct, _id: 'prej', status: 'REJECTED', rejectionReason: 'Fotos borrosas' };
    const f = setup({ id: product._id, role: 'editor', granted: ['products.update', 'products.submitReview'] });
    flushLoad(product);
    f.detectChanges();
    const cmp = f.componentInstance as any;

    cmp.submitForReview();

    httpMock.expectOne((r) => r.url.endsWith('/product/prej') && r.method === 'PATCH').flush({ msg: 'ok', data: product });
    const toDraft = httpMock.expectOne((r) => r.url.endsWith('/product/prej/status'));
    expect(toDraft.request.body.toStatus).toBe('DRAFT');
    toDraft.flush({ msg: 'ok', data: { ...product, status: 'DRAFT' } });
    const toReview = httpMock.expectOne((r) => r.url.endsWith('/product/prej/status'));
    expect(toReview.request.body.toStatus).toBe('PENDING_REVIEW');
    toReview.flush({ msg: 'ok', data: { ...product, status: 'PENDING_REVIEW' } });

    expect(cmp.product().status).toBe('PENDING_REVIEW');
  });

  // ---- F3-CLOSURE · 409 ------------------------------------------------
  //
  // El producto puede cambiar de estado en el servidor mientras el editor lo
  // tiene abierto. La UI NO debe recargar automáticamente (perdería cambios
  // locales sin avisar): debe mostrar un banner persistente y ofrecer una
  // acción explícita de "Recargar". Ver F3-CLOSURE §5/§6/§7.

  it('F3-CLOSURE · 409 al reenviar: informa el conflicto SIN recargar automáticamente ni perder cambios locales', () => {
    const product: AdminProduct = { ...readyProduct, _id: 'p409', status: 'CHANGES_REQUESTED' };
    const f = setup({ id: product._id, role: 'editor', granted: ['products.update', 'products.submitReview'] });
    flushLoad(product);
    f.detectChanges();
    const cmp = f.componentInstance as any;

    cmp.form.patchValue({ name: 'Cambio local sin guardar' });
    expect(cmp.conflict()).toBe(false);

    cmp.submitForReview();
    httpMock.expectOne((r) => r.url.endsWith('/product/p409') && r.method === 'PATCH').flush({ msg: 'ok', data: product });
    httpMock
      .expectOne((r) => r.url.endsWith('/product/p409/status'))
      .flush({ msg: 'El producto cambió de estado' }, { status: 409, statusText: 'Conflict' });

    // se informa el conflicto (banner persistente, `conflict()`)
    expect(cmp.conflict()).toBe(true);
    // NO se dispara ninguna recarga automática: no hay más requests pendientes
    httpMock.expectNone((r) => r.url.endsWith('/category'));
    httpMock.expectNone((r) => r.url.endsWith('/product/p409'));
    // los cambios locales del formulario se conservan intactos
    expect(cmp.form.controls.name.value).toBe('Cambio local sin guardar');
    expect(cmp.product().status).toBe('CHANGES_REQUESTED');
  });

  it('F3-CLOSURE · 409: "Recargar" explícito pide el producto de nuevo y refleja el estado real', () => {
    const product: AdminProduct = { ...readyProduct, _id: 'p409b', status: 'CHANGES_REQUESTED' };
    const f = setup({ id: product._id, role: 'editor', granted: ['products.update', 'products.submitReview'] });
    flushLoad(product);
    f.detectChanges();
    const cmp = f.componentInstance as any;

    cmp.submitForReview();
    httpMock.expectOne((r) => r.url.endsWith('/product/p409b') && r.method === 'PATCH').flush({ msg: 'ok', data: product });
    httpMock
      .expectOne((r) => r.url.endsWith('/product/p409b/status'))
      .flush({ msg: 'El producto cambió de estado' }, { status: 409, statusText: 'Conflict' });
    expect(cmp.conflict()).toBe(true);

    cmp.reloadAfterConflict();
    expect(cmp.conflict()).toBe(false);

    httpMock.expectOne((r) => r.url.endsWith('/category')).flush({ msg: 'ok', data: [] });
    httpMock
      .expectOne((r) => r.url.endsWith('/product/p409b'))
      .flush({ msg: 'ok', data: { ...product, status: 'PENDING_REVIEW' } });

    expect(cmp.product().status).toBe('PENDING_REVIEW');
    expect(cmp.conflict()).toBe(false);
  });

  it('F3-CLOSURE · banner de conflicto: aparece el aviso y el botón "Recargar" en el DOM', () => {
    const product: AdminProduct = { ...readyProduct, _id: 'p409c', status: 'CHANGES_REQUESTED' };
    const f = setup({ id: product._id, role: 'editor', granted: ['products.update', 'products.submitReview'] });
    flushLoad(product);
    f.detectChanges();
    const cmp = f.componentInstance as any;

    cmp.submitForReview();
    httpMock.expectOne((r) => r.url.endsWith('/product/p409c') && r.method === 'PATCH').flush({ msg: 'ok', data: product });
    httpMock
      .expectOne((r) => r.url.endsWith('/product/p409c/status'))
      .flush({ msg: 'El producto cambió de estado' }, { status: 409, statusText: 'Conflict' });
    f.detectChanges();

    expect(f.nativeElement.textContent).toContain('El producto cambió en el servidor');
    const reloadBtn = Array.from(f.nativeElement.querySelectorAll('button')).find((b: any) =>
      b.textContent.includes('Recargar'),
    ) as HTMLButtonElement | undefined;
    expect(reloadBtn).toBeTruthy();

    reloadBtn!.click();
    f.detectChanges();
    expect(cmp.conflict()).toBe(false);
    httpMock.expectOne((r) => r.url.endsWith('/category')).flush({ msg: 'ok', data: [] });
    httpMock
      .expectOne((r) => r.url.endsWith('/product/p409c'))
      .flush({ msg: 'ok', data: product });
  });

  it('F3 · producto ajeno / inexistente (404 del backend): estado de error, sin formulario editable', () => {
    const f = setup({ id: 'ajeno', role: 'editor', granted: ['products.update', 'products.submitReview'] });
    httpMock.expectOne((r) => r.url.endsWith('/category')).flush({ msg: 'ok', data: [] });
    httpMock
      .expectOne((r) => r.url.endsWith('/product/ajeno'))
      .flush({ msg: 'El producto no se encuentra registrado' }, { status: 404, statusText: 'Not Found' });
    f.detectChanges();
    const cmp = f.componentInstance as any;
    expect(cmp.state()).toBe('error');
    expect(cmp.product()).toBeNull();
  });

  it('F3 · buildPayload: heightCm numérico y la imagen principal se sincroniza a type MAIN', () => {
    const f = setup({ role: 'editor', granted: ['products.create'] });
    flushLoad(null);
    f.detectChanges();
    const cmp = f.componentInstance as any;

    cmp.form.patchValue({ name: 'X', slug: 'x', price: 100 });
    cmp.form.controls.modelInfo.patchValue({ size: 'M', heightCm: 190 });
    cmp.addImage();
    cmp.images.at(0).patchValue({ url: 'http://x/a.png', type: 'DETAIL' });

    const payload = cmp['buildPayload']();
    expect(payload.modelInfo).toEqual({ size: 'M', heightCm: 190 });
    expect(payload.images[0].isMain).toBe(true);
    expect(payload.images[0].type).toBe('MAIN');
    expect(payload.images[0].order).toBe(0);
  });

  // ---- FASE 4 — upload real (Cloudinary vía backend) -----------------------

  function fakeFileInputEvent(files: File[]): Event {
    const input = document.createElement('input');
    input.type = 'file';
    Object.defineProperty(input, 'files', { value: files, writable: false });
    return { target: input } as unknown as Event;
  }

  const jpegFile = (name = 'foto.jpg', size = 1024) => {
    const file = new File([new Uint8Array(size)], name, { type: 'image/jpeg' });
    return file;
  };

  it('F4 · seleccionar un JPEG válido en un producto existente dispara el upload real', () => {
    const f = setup({ id: readyProduct._id, role: 'editor', granted: ['products.update', 'products.submitReview'] });
    flushLoad(readyProduct);
    f.detectChanges();
    const cmp = f.componentInstance as any;

    cmp.onFilesSelected(fakeFileInputEvent([jpegFile()]));

    const req = httpMock.expectOne((r) => r.url.endsWith(`/product/${readyProduct._id}/images`) && r.method === 'POST');
    expect(req.request.body instanceof FormData).toBe(true);
    expect((req.request.body as FormData).get('image')).toBeInstanceOf(File);

    const updated: AdminProduct = {
      ...readyProduct,
      images: [
        ...readyProduct.images,
        { _id: 'img-new', url: 'https://res.cloudinary.test/x.jpg', isMain: false, type: 'DETAIL', order: 1, alt: '' },
      ],
    };
    req.flush({ msg: 'ok', data: updated });

    expect(cmp.pendingUploads()).toEqual([]);
    expect(cmp.images.length).toBe(2);
    expect(cmp.images.at(1).controls._id.value).toBe('img-new');
  });

  it('F4 · producto NUEVO (sin guardar aún): no permite subir archivos, no llama al backend', () => {
    const f = setup({ role: 'editor', granted: ['products.create'] });
    flushLoad(null);
    f.detectChanges();
    const cmp = f.componentInstance as any;

    cmp.onFilesSelected(fakeFileInputEvent([jpegFile()]));

    httpMock.expectNone((r) => r.url.includes('/images'));
    expect(cmp.pendingUploads().length).toBe(1);
    expect(cmp.pendingUploads()[0].status).toBe('error');
    expect(cmp.pendingUploads()[0].message).toContain('Guarda el producto');
  });

  it('F4 · tipo de archivo no permitido se rechaza en el cliente (UX), sin llamar al backend', () => {
    const f = setup({ id: readyProduct._id, role: 'editor', granted: ['products.update'] });
    flushLoad(readyProduct);
    f.detectChanges();
    const cmp = f.componentInstance as any;

    const badFile = new File(['x'], 'a.txt', { type: 'text/plain' });
    cmp.onFilesSelected(fakeFileInputEvent([badFile]));

    httpMock.expectNone((r) => r.url.includes('/images'));
    expect(cmp.pendingUploads()[0].status).toBe('error');
    expect(cmp.pendingUploads()[0].message).toMatch(/no permitido/i);
  });

  it('F4 · archivo que supera 8MB se rechaza en el cliente, sin llamar al backend', () => {
    const f = setup({ id: readyProduct._id, role: 'editor', granted: ['products.update'] });
    flushLoad(readyProduct);
    f.detectChanges();
    const cmp = f.componentInstance as any;

    const bigFile = jpegFile('grande.jpg', 8 * 1024 * 1024 + 1);
    cmp.onFilesSelected(fakeFileInputEvent([bigFile]));

    httpMock.expectNone((r) => r.url.includes('/images'));
    expect(cmp.pendingUploads()[0].status).toBe('error');
    expect(cmp.pendingUploads()[0].message).toMatch(/tamaño máximo/i);
  });

  it('F4 · con 10 imágenes ya cargadas, bloquea nuevos uploads en el cliente', () => {
    const tenImages: AdminProduct['images'] = Array.from({ length: 10 }, (_, i) => ({
      _id: `img-${i}`,
      url: `http://x/${i}.png`,
      isMain: i === 0,
      type: i === 0 ? 'MAIN' : 'DETAIL',
      order: i,
      alt: '',
    }));
    const product: AdminProduct = { ...readyProduct, _id: 'pfull', images: tenImages };
    const f = setup({ id: product._id, role: 'editor', granted: ['products.update'] });
    flushLoad(product);
    f.detectChanges();
    const cmp = f.componentInstance as any;

    cmp.onFilesSelected(fakeFileInputEvent([jpegFile()]));

    httpMock.expectNone((r) => r.url.includes('/images'));
    expect(cmp.pendingUploads()[0].message).toMatch(/máximo de imágenes/i);
  });

  it('F4 · fallo del backend en el upload: el archivo queda marcado como error con el mensaje del servidor', () => {
    const f = setup({ id: readyProduct._id, role: 'editor', granted: ['products.update'] });
    flushLoad(readyProduct);
    f.detectChanges();
    const cmp = f.componentInstance as any;

    cmp.onFilesSelected(fakeFileInputEvent([jpegFile()]));
    const req = httpMock.expectOne((r) => r.url.endsWith(`/product/${readyProduct._id}/images`));
    req.flush({ msg: 'El archivo de imagen está dañado o no se pudo procesar.' }, { status: 400, statusText: 'Bad Request' });

    expect(cmp.pendingUploads()[0].status).toBe('error');
    expect(cmp.pendingUploads()[0].message).toContain('dañado');
    // La imagen NUNCA se muestra como guardada tras un fallo.
    expect(cmp.images.length).toBe(readyProduct.images.length);
  });

  it('F4 · quitar una imagen YA PERSISTIDA dispara DELETE real al backend', () => {
    const product: AdminProduct = {
      ...readyProduct,
      _id: 'pdel',
      images: [{ _id: 'img-1', url: 'http://x/1.png', isMain: true, type: 'MAIN', order: 0, alt: '' }],
    };
    const f = setup({ id: product._id, role: 'editor', granted: ['products.update'] });
    flushLoad(product);
    f.detectChanges();
    const cmp = f.componentInstance as any;

    cmp.removeImage(0);

    expect(cmp.deletingImageIds().has('img-1')).toBe(true);
    const req = httpMock.expectOne((r) => r.url.endsWith(`/product/pdel/images/img-1`) && r.method === 'DELETE');
    req.flush({ msg: 'ok', data: { ...product, images: [] } });

    expect(cmp.deletingImageIds().has('img-1')).toBe(false);
    expect(cmp.images.length).toBe(0);
  });

  it('F4 · quitar una imagen LOCAL (sin _id, pegada por URL, aún no guardada) NO llama al backend', () => {
    const f = setup({ role: 'editor', granted: ['products.create'] });
    flushLoad(null);
    f.detectChanges();
    const cmp = f.componentInstance as any;

    cmp.addImage();
    cmp.images.at(0).patchValue({ url: 'http://x/manual.png' });

    cmp.removeImage(0);

    httpMock.expectNone((r) => r.url.includes('/images'));
    expect(cmp.images.length).toBe(0);
  });

  // ---- F4-CLOSURE §1 — preservación de cambios locales ---------------------

  it('F4-CLOSURE · un `alt` editado localmente (aún sin guardar) sobrevive a un upload de OTRA imagen', () => {
    const product: AdminProduct = {
      ...readyProduct,
      _id: 'pmerge1',
      images: [{ _id: 'img-a', url: 'http://x/a.png', isMain: true, type: 'MAIN', order: 0, alt: '' }],
    };
    const f = setup({ id: product._id, role: 'editor', granted: ['products.update'] });
    flushLoad(product);
    f.detectChanges();
    const cmp = f.componentInstance as any;

    // El editor escribe un alt nuevo (interacción real -> marca `alt` dirty).
    const altInput: HTMLInputElement = f.nativeElement.querySelectorAll('input[formcontrolname="alt"]')[0];
    altInput.value = 'Camiseta vista frontal';
    altInput.dispatchEvent(new Event('input'));
    f.detectChanges();
    expect(cmp.images.at(0).controls.alt.dirty).toBe(true);

    // Sube una imagen nueva: la respuesta del servidor NO trae el alt local
    // (todavía no se guardó), pero el merge no debe pisarlo.
    cmp.onFilesSelected(fakeFileInputEvent([jpegFile()]));
    const req = httpMock.expectOne((r) => r.url.endsWith(`/product/pmerge1/images`));
    req.flush({
      msg: 'ok',
      data: {
        ...product,
        images: [
          { _id: 'img-a', url: 'http://x/a.png', isMain: true, type: 'MAIN', order: 0, alt: '' }, // el alt local NO llegó al servidor
          { _id: 'img-b', url: 'https://cdn.test/b.jpg', isMain: false, type: 'DETAIL', order: 1, alt: '' },
        ],
      },
    });

    expect(cmp.images.length).toBe(2);
    expect(cmp.images.at(0).controls.alt.value).toBe('Camiseta vista frontal');
    expect(cmp.images.at(1).controls._id.value).toBe('img-b');
  });

  it('F4-CLOSURE · un reordenamiento local sobrevive a un delete de otra imagen', () => {
    const product: AdminProduct = {
      ...readyProduct,
      _id: 'pmerge2',
      images: [
        { _id: 'img-1', url: 'http://x/1.png', isMain: true, type: 'MAIN', order: 0, alt: '' },
        { _id: 'img-2', url: 'http://x/2.png', isMain: false, type: 'DETAIL', order: 1, alt: '' },
        { _id: 'img-3', url: 'http://x/3.png', isMain: false, type: 'DETAIL', order: 2, alt: '' },
      ],
    };
    const f = setup({ id: product._id, role: 'editor', granted: ['products.update'] });
    flushLoad(product);
    f.detectChanges();
    const cmp = f.componentInstance as any;

    // Reordena: img-3 pasa a la posición 0 (dos "subir" desde el índice 2).
    cmp.moveImage(2, -1);
    cmp.moveImage(1, -1);
    expect(cmp.images.controls.map((g: any) => g.controls._id.value)).toEqual(['img-3', 'img-1', 'img-2']);

    // Borra img-2 (ahora en la última posición local).
    cmp.removeImage(2);
    const req = httpMock.expectOne((r) => r.url.endsWith('/product/pmerge2/images/img-2') && r.method === 'DELETE');
    req.flush({
      msg: 'ok',
      data: { ...product, images: [product.images[0], product.images[2]] }, // img-1, img-3 (orden del SERVIDOR, distinto al local)
    });

    // El orden LOCAL (post-reorden) se conserva: img-3 sigue primero.
    expect(cmp.images.controls.map((g: any) => g.controls._id.value)).toEqual(['img-3', 'img-1']);
  });

  it('F4-CLOSURE · una principal elegida localmente (sin guardar) NO es pisada por la promoción automática del servidor tras un delete', () => {
    const product: AdminProduct = {
      ...readyProduct,
      _id: 'pmerge3',
      images: [
        { _id: 'img-1', url: 'http://x/1.png', isMain: true, type: 'MAIN', order: 0, alt: '' },
        { _id: 'img-2', url: 'http://x/2.png', isMain: false, type: 'DETAIL', order: 1, alt: '' },
        { _id: 'img-3', url: 'http://x/3.png', isMain: false, type: 'DETAIL', order: 2, alt: '' },
      ],
    };
    const f = setup({ id: product._id, role: 'editor', granted: ['products.update'] });
    flushLoad(product);
    f.detectChanges();
    const cmp = f.componentInstance as any;

    // El editor elige img-3 como principal LOCALMENTE (sin guardar todavía).
    cmp.setMain(2);
    expect(cmp.images.at(2).controls.isMain.value).toBe(true);

    // Borra la que ERA la principal persistida (img-1). El backend, al no
    // saber nada del cambio local, promociona img-2 (posición 0 tras el
    // pull) a `isMain:true` en su respuesta.
    cmp.removeImage(0);
    const req = httpMock.expectOne((r) => r.url.endsWith('/product/pmerge3/images/img-1') && r.method === 'DELETE');
    req.flush({
      msg: 'ok',
      data: {
        ...product,
        images: [
          { _id: 'img-2', url: 'http://x/2.png', isMain: true, type: 'MAIN', order: 0, alt: '' }, // promovida por el backend
          { _id: 'img-3', url: 'http://x/3.png', isMain: false, type: 'DETAIL', order: 1, alt: '' },
        ],
      },
    });

    // La elección LOCAL (img-3) prevalece: sigue marcada como principal.
    const img3 = cmp.images.controls.find((g: any) => g.controls._id.value === 'img-3');
    const img2 = cmp.images.controls.find((g: any) => g.controls._id.value === 'img-2');
    expect(img3.controls.isMain.value).toBe(true);
    expect(img2.controls.isMain.value).toBe(false);
  });

  // ---- F4-CLOSURE §3 — uploads múltiples/concurrentes en el cliente --------

  it('F4-CLOSURE · seleccionar más archivos que cupos libres rechaza los sobrantes SIN llamar al backend para ellos', () => {
    const eightImages: AdminProduct['images'] = Array.from({ length: 8 }, (_, i) => ({
      _id: `img-${i}`,
      url: `http://x/${i}.png`,
      isMain: i === 0,
      type: i === 0 ? 'MAIN' : 'DETAIL',
      order: i,
      alt: '',
    }));
    const product: AdminProduct = { ...readyProduct, _id: 'pmulti', images: eightImages };
    const f = setup({ id: product._id, role: 'editor', granted: ['products.update'] });
    flushLoad(product);
    f.detectChanges();
    const cmp = f.componentInstance as any;

    // 8 imágenes ya cargadas + 5 archivos nuevos seleccionados a la vez ->
    // solo caben 2 (límite 10). El bucle es SÍNCRONO: el archivo #3 del lote
    // debe verse ya sin cupo aunque las respuestas HTTP de #1/#2 no hayan
    // llegado todavía.
    const files = [jpegFile('a.jpg'), jpegFile('b.jpg'), jpegFile('c.jpg'), jpegFile('d.jpg'), jpegFile('e.jpg')];
    cmp.onFilesSelected(fakeFileInputEvent(files));

    const uploadReqs = httpMock.match((r) => r.url.endsWith('/product/pmulti/images'));
    expect(uploadReqs.length).toBe(2); // solo se disparan 2 requests HTTP reales
    const newImages = [0, 1].map((i) => ({
      _id: `new-${i}`,
      url: `https://cdn.test/new-${i}.jpg`,
      isMain: false,
      type: 'DETAIL' as const,
      order: 8 + i,
      alt: '',
    }));
    // Respuestas cumulativas (como si las dos escrituras del backend, aunque
    // concurrentes, quedaran ambas reflejadas): evita que el merge borre la
    // imagen ya añadida por la primera respuesta al procesar la segunda.
    uploadReqs[0].flush({ msg: 'ok', data: { ...product, images: [...eightImages, newImages[0]] } });
    uploadReqs[1].flush({ msg: 'ok', data: { ...product, images: [...eightImages, ...newImages] } });

    const errored = cmp.pendingUploads().filter((u: any) => u.status === 'error');
    expect(errored.length).toBe(3);
    expect(errored[0].message).toMatch(/máximo de imágenes/i);
  });

  // ---- FASE 5 — Variantes + Stock -------------------------------------------

  it('F5 · stock de variante decimal se rechaza en el cliente (validador de UX, el backend es la autoridad real)', () => {
    const f = setup({ role: 'editor', granted: ['products.create'] });
    flushLoad(null);
    f.detectChanges();
    const cmp = f.componentInstance as any;

    cmp.addVariant();
    cmp.variants.at(0).patchValue({ sku: 'SKU-DEC', color: 'Negro', stock: 2.5 });

    expect(cmp.variants.at(0).controls.stock.errors).toEqual({ integer: true });
    expect(cmp.variants.at(0).controls.stock.valid).toBe(false);
  });

  it('F5 · stock de variante negativo se rechaza en el cliente (validador de UX, el backend es la autoridad real)', () => {
    const f = setup({ role: 'editor', granted: ['products.create'] });
    flushLoad(null);
    f.detectChanges();
    const cmp = f.componentInstance as any;

    cmp.addVariant();
    cmp.variants.at(0).patchValue({ sku: 'SKU-NEG', color: 'Negro', stock: -1 });

    expect(cmp.variants.at(0).controls.stock.errors).toEqual({ min: { min: 0, actual: -1 } });
    expect(cmp.variants.at(0).controls.stock.valid).toBe(false);
  });

  // ---- F5-CLOSURE — talla obligatoria ---------------------------------------

  it('F5-CLOSURE · una variante NUEVA (addVariant) inicia con talla "Única", no vacía', () => {
    const f = setup({ role: 'editor', granted: ['products.create'] });
    flushLoad(null);
    f.detectChanges();
    const cmp = f.componentInstance as any;

    cmp.addVariant();

    expect(cmp.variants.at(0).controls.size.value).toBe('Única');
    expect(cmp.variants.at(0).controls.size.valid).toBe(true);
  });

  it('F5-CLOSURE · talla "M" es válida', () => {
    const f = setup({ role: 'editor', granted: ['products.create'] });
    flushLoad(null);
    f.detectChanges();
    const cmp = f.componentInstance as any;

    cmp.addVariant();
    cmp.variants.at(0).controls.size.setValue('M');

    expect(cmp.variants.at(0).controls.size.valid).toBe(true);
  });

  it('F5-CLOSURE · talla "Única" es válida', () => {
    const f = setup({ role: 'editor', granted: ['products.create'] });
    flushLoad(null);
    f.detectChanges();
    const cmp = f.componentInstance as any;

    cmp.addVariant();
    cmp.variants.at(0).controls.size.setValue('Única');

    expect(cmp.variants.at(0).controls.size.valid).toBe(true);
  });

  it('F5-CLOSURE · talla vacía ("") produce error en el control', () => {
    const f = setup({ role: 'editor', granted: ['products.create'] });
    flushLoad(null);
    f.detectChanges();
    const cmp = f.componentInstance as any;

    cmp.addVariant();
    cmp.variants.at(0).controls.size.setValue('');

    expect(cmp.variants.at(0).controls.size.errors).toEqual({ required: true });
    expect(cmp.variants.at(0).controls.size.valid).toBe(false);
  });

  it('F5-CLOSURE · talla solo espacios ("   ") produce error en el control', () => {
    const f = setup({ role: 'editor', granted: ['products.create'] });
    flushLoad(null);
    f.detectChanges();
    const cmp = f.componentInstance as any;

    cmp.addVariant();
    cmp.variants.at(0).controls.size.setValue('   ');

    expect(cmp.variants.at(0).controls.size.errors).toEqual({ required: true });
    expect(cmp.variants.at(0).controls.size.valid).toBe(false);
  });

  it('F5-CLOSURE · collectSubmitBlockers detecta talla vacía en una variante', () => {
    const f = setup({ role: 'editor', granted: ['products.create'] });
    flushLoad(null);
    f.detectChanges();
    const cmp = f.componentInstance as any;

    cmp.addVariant();
    cmp.variants.at(0).patchValue({ sku: 'SKU-1', color: 'Negro', size: '', stock: 5 });

    const blockers = cmp.collectSubmitBlockers();
    expect(blockers.some((b: string) => /talla/i.test(b))).toBe(true);
  });

  it('F5 · collectSubmitBlockers detecta SKU duplicado dentro del mismo producto', () => {
    const f = setup({ role: 'editor', granted: ['products.create'] });
    flushLoad(null);
    f.detectChanges();
    const cmp = f.componentInstance as any;

    cmp.addVariant();
    cmp.addVariant();
    cmp.variants.at(0).patchValue({ sku: 'DUP-1', color: 'Negro', size: 'S', stock: 1 });
    cmp.variants.at(1).patchValue({ sku: 'dup-1', color: 'Blanco', size: 'M', stock: 2 }); // mismo SKU, distinta caja

    const blockers = cmp.collectSubmitBlockers();
    expect(blockers.some((b: string) => /mismo SKU/i.test(b))).toBe(true);
  });

  it('F5 · collectSubmitBlockers detecta color+talla duplicados aunque el SKU sea distinto', () => {
    const f = setup({ role: 'editor', granted: ['products.create'] });
    flushLoad(null);
    f.detectChanges();
    const cmp = f.componentInstance as any;

    cmp.addVariant();
    cmp.addVariant();
    cmp.variants.at(0).patchValue({ sku: 'A-1', color: 'Blanco', size: 'M', stock: 1 });
    cmp.variants.at(1).patchValue({ sku: 'A-2', color: '  BLANCO  ', size: 'm', stock: 2 }); // mismo combo normalizado

    const blockers = cmp.collectSubmitBlockers();
    expect(blockers.some((b: string) => /color y talla/i.test(b))).toBe(true);
  });

  it('F5 · collectSubmitBlockers NO marca error para dos variantes del mismo color con tallas distintas', () => {
    const f = setup({ role: 'editor', granted: ['products.create'] });
    flushLoad(null);
    f.detectChanges();
    const cmp = f.componentInstance as any;

    cmp.form.patchValue({ name: 'X', slug: 'x', price: 100, description: 'd', details: 'd', shippingInfo: 's', returnsInfo: 'r' });
    cmp.toggleCategory('cHombre');
    cmp.addImage();
    cmp.images.at(0).patchValue({ url: 'http://x/a.png' });
    cmp.addVariant();
    cmp.addVariant();
    cmp.variants.at(0).patchValue({ sku: 'B-1', color: 'Negro', size: 'S', stock: 1 });
    cmp.variants.at(1).patchValue({ sku: 'B-2', color: 'Negro', size: 'M', stock: 2 });

    const blockers = cmp.collectSubmitBlockers();
    expect(blockers.some((b: string) => /color y talla/i.test(b))).toBe(false);
    expect(blockers.some((b: string) => /mismo SKU/i.test(b))).toBe(false);
  });

  // ---- F6 — Admin Review: detalle completo + transiciones -------------------

  const pendingProduct: AdminProduct = {
    ...readyProduct,
    _id: 'prev1',
    status: 'PENDING_REVIEW',
    submittedAt: '2026-01-01T00:00:00Z',
  };
  const approvedProduct: AdminProduct = { ...readyProduct, _id: 'prev2', status: 'APPROVED' };

  it('F6 · admin con permisos completos ve Aprobar/Solicitar cambios/Rechazar en PENDING_REVIEW', () => {
    const f = setup({
      id: pendingProduct._id,
      role: 'administrador',
      granted: ['products.update', 'products.approve', 'products.requestChanges', 'products.reject'],
    });
    flushLoad(pendingProduct);
    f.detectChanges();
    const cmp = f.componentInstance as any;

    expect(cmp.canApproveReview()).toBe(true);
    expect(cmp.canRequestChangesReview()).toBe(true);
    expect(cmp.canRejectReview()).toBe(true);
    expect(cmp.canPublishReview()).toBe(false);

    const html = f.nativeElement.textContent as string;
    expect(html).toContain('Aprobar');
    expect(html).toContain('Solicitar cambios');
    expect(html).toContain('Rechazar');
  });

  it('F6 · editor viendo PENDING_REVIEW: NUNCA ve acciones de revisión (sin los permisos)', () => {
    const f = setup({
      id: pendingProduct._id,
      role: 'editor',
      granted: ['products.update', 'products.submitReview'],
    });
    flushLoad(pendingProduct);
    f.detectChanges();
    const cmp = f.componentInstance as any;

    expect(cmp.canApproveReview()).toBe(false);
    expect(cmp.canRequestChangesReview()).toBe(false);
    expect(cmp.canRejectReview()).toBe(false);

    const html = f.nativeElement.textContent as string;
    expect(html).not.toContain('Aprobar');
    expect(html).not.toContain('Solicitar cambios');
  });

  it('F6 · shop_manager viendo PENDING_REVIEW: NUNCA ve acciones de revisión (Decisión funcional §2)', () => {
    const f = setup({
      id: pendingProduct._id,
      role: 'shop_manager',
      granted: ['products.update', 'products.submitReview', 'products.toggleActive'],
    });
    flushLoad(pendingProduct);
    f.detectChanges();
    const cmp = f.componentInstance as any;

    expect(cmp.canApproveReview()).toBe(false);
    expect(cmp.canRequestChangesReview()).toBe(false);
    expect(cmp.canRejectReview()).toBe(false);
  });

  it('F6 · Aprobar ejecuta PATCH /status con toStatus APPROVED, sin comentario', () => {
    const f = setup({
      id: pendingProduct._id,
      role: 'administrador',
      granted: ['products.update', 'products.approve'],
    });
    flushLoad(pendingProduct);
    f.detectChanges();
    const cmp = f.componentInstance as any;

    cmp.approveReview();
    const req = httpMock.expectOne((r) => r.url.endsWith('/product/prev1/status'));
    expect(req.request.body).toEqual({ toStatus: 'APPROVED', comment: undefined });
    req.flush({ msg: 'ok', data: { ...pendingProduct, status: 'APPROVED' } });

    expect(cmp.product().status).toBe('APPROVED');
  });

  // F6 — `requestChangesReview`/`rejectReview` son `async` (esperan
  // `dialog.promptText()`). Estos tests devuelven la promesa vía `.then()` en
  // vez de usar `async/await` en la función del propio test: con
  // `async () => { await ...; }` se observó que un microtask quedaba
  // pendiente al terminar el test y contaminaba el render de los tests
  // siguientes en este mismo archivo (`fakeAsync`/`tick()` tampoco está
  // disponible en este runner — Vitest sin `ProxyZone`).
  it('F6 · Solicitar cambios pide comentario obligatorio y envía CHANGES_REQUESTED + comment', () => {
    const f = setup({
      id: pendingProduct._id,
      role: 'administrador',
      granted: ['products.update', 'products.requestChanges'],
    });
    flushLoad(pendingProduct);
    f.detectChanges();
    const cmp = f.componentInstance as any;
    const dialog = TestBed.inject(AdminDialog);
    vi.spyOn(dialog, 'promptText').mockResolvedValue('Falta la ficha técnica.');

    return cmp.requestChangesReview().then(() => {
      const req = httpMock.expectOne((r) => r.url.endsWith('/product/prev1/status'));
      expect(req.request.body).toEqual({ toStatus: 'CHANGES_REQUESTED', comment: 'Falta la ficha técnica.' });
      req.flush({ msg: 'ok', data: { ...pendingProduct, status: 'CHANGES_REQUESTED' } });
    });
  });

  it('F6 · Solicitar cambios cancelado (sin comentario) -> NO envía ninguna request', () => {
    const f = setup({
      id: pendingProduct._id,
      role: 'administrador',
      granted: ['products.update', 'products.requestChanges'],
    });
    flushLoad(pendingProduct);
    f.detectChanges();
    const cmp = f.componentInstance as any;
    const dialog = TestBed.inject(AdminDialog);
    vi.spyOn(dialog, 'promptText').mockResolvedValue(null);

    return cmp.requestChangesReview().then(() => {
      httpMock.expectNone((r) => r.url.endsWith('/product/prev1/status'));
    });
  });

  it('F6 · Rechazar pide motivo obligatorio y envía REJECTED + comment', () => {
    const f = setup({
      id: pendingProduct._id,
      role: 'administrador',
      granted: ['products.update', 'products.reject'],
    });
    flushLoad(pendingProduct);
    f.detectChanges();
    const cmp = f.componentInstance as any;
    const dialog = TestBed.inject(AdminDialog);
    vi.spyOn(dialog, 'promptText').mockResolvedValue('No cumple la línea.');

    return cmp.rejectReview().then(() => {
      const req = httpMock.expectOne((r) => r.url.endsWith('/product/prev1/status'));
      expect(req.request.body).toEqual({ toStatus: 'REJECTED', comment: 'No cumple la línea.' });
      req.flush({ msg: 'ok', data: { ...pendingProduct, status: 'REJECTED', rejectionReason: 'No cumple la línea.' } });
    });
  });

  it('F6 · Publicar (APPROVED) disponible solo con products.publish; ejecuta PUBLISHED', () => {
    const f = setup({
      id: approvedProduct._id,
      role: 'administrador',
      granted: ['products.update', 'products.publish'],
    });
    flushLoad(approvedProduct);
    f.detectChanges();
    const cmp = f.componentInstance as any;

    expect(cmp.canPublishReview()).toBe(true);
    cmp.publishReview();
    const req = httpMock.expectOne((r) => r.url.endsWith('/product/prev2/status'));
    expect(req.request.body.toStatus).toBe('PUBLISHED');
    req.flush({ msg: 'ok', data: { ...approvedProduct, status: 'PUBLISHED', isActive: true } });
  });

  it('F6 · 409 al aprobar: informa el conflicto SIN recargar automáticamente (mismo patrón que F3-CLOSURE)', () => {
    const f = setup({
      id: pendingProduct._id,
      role: 'administrador',
      granted: ['products.update', 'products.approve'],
    });
    flushLoad(pendingProduct);
    f.detectChanges();
    const cmp = f.componentInstance as any;

    cmp.approveReview();
    httpMock
      .expectOne((r) => r.url.endsWith('/product/prev1/status'))
      .flush({ msg: 'El producto cambió de estado' }, { status: 409, statusText: 'Conflict' });

    expect(cmp.conflict()).toBe(true);
    expect(cmp.product().status).toBe('PENDING_REVIEW');
  });

  it('F6 · workflowHistory muestra el nombre del actor cuando el backend lo populó', () => {
    const withHistory: AdminProduct = {
      ...pendingProduct,
      _id: 'prev3',
      workflowHistory: [
        {
          action: 'submit',
          fromStatus: 'DRAFT',
          toStatus: 'PENDING_REVIEW',
          by: { _id: 'u1', name: 'Editor A F6' },
          at: '2026-01-01T00:00:00Z',
        },
      ],
    };
    const f = setup({ id: withHistory._id, role: 'administrador', granted: ['products.update'] });
    flushLoad(withHistory);
    f.detectChanges();
    const cmp = f.componentInstance as any;

    expect(cmp.historyActorName(withHistory.workflowHistory![0])).toBe('Editor A F6');
  });
});
