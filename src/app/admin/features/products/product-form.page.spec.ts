import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { vi } from 'vitest';

import ProductFormPage from './product-form.page';
import { PermissionsService } from '../../core/services/permissions';
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
    expect(req.request.body.variants).toEqual([{ sku: 'SKU-1', color: 'Negro', size: '', stock: 5 }]);
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

  it('editor viendo un PUBLISHED: contenido bloqueado, sin "enviar a revisión", con opción de reabrir', () => {
    const f = setup({ id: publishedProduct._id, role: 'editor', granted: ['products.update', 'products.submitReview'] });
    flushLoad(publishedProduct);
    f.detectChanges();
    const cmp = f.componentInstance as any;

    expect(cmp.contentLocked()).toBe(true);
    expect(cmp.canSubmitReview()).toBe(false);
    expect(cmp.canReopen()).toBe(true);
    expect(cmp.form.disabled).toBe(true);
  });

  it('administrador viendo un PUBLISHED: NUNCA bloqueado (autoridad final, Decisión §1)', () => {
    const f = setup({ id: publishedProduct._id, role: 'administrador', granted: ['products.update', 'products.submitReview'] });
    flushLoad(publishedProduct);
    f.detectChanges();
    const cmp = f.componentInstance as any;

    expect(cmp.contentLocked()).toBe(false);
    expect(cmp.form.disabled).toBe(false);
  });

  it('"volver a borrador" transiciona PUBLISHED -> DRAFT vía PATCH /status', () => {
    const f = setup({ id: publishedProduct._id, role: 'editor', granted: ['products.update', 'products.submitReview'] });
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
});
