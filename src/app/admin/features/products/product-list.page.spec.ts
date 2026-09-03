import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';

import ProductListPage from './product-list.page';
import { PermissionsService } from '../../core/services/permissions';
import { AdminDialog } from '../../core/services/admin-dialog';
import type { Permission } from '../../core/models/permission.model';
import type { AdminProduct } from '../../core/models/admin.models';

/**
 * FASE 3 — Product Domain + Editor Workflow.
 *
 * Cubre el "Criterio especial" del brief: editor y shop_manager NUNCA pueden
 * aprobar/rechazar/publicar; administrador sí puede todo; los botones de
 * workflow solo aparecen cuando el `status` del producto los admite.
 *
 * `PermissionsService` se reemplaza por un doble simple (deriva de
 * `HttpAuth`/sessionStorage, no vale la pena montar esa cadena aquí); el resto
 * (HTTP real vía `HttpTestingController`, DOM real) sigue el mismo patrón que
 * `basicos.spec.ts`.
 */
describe('ProductListPage (admin)', () => {
  let httpMock: HttpTestingController;

  function fakePermissions(granted: Permission[]) {
    return {
      role: () => 'administrador',
      can: (p: Permission) => granted.includes(p),
      canAny: (ps: readonly Permission[]) => ps.some((p) => granted.includes(p)),
      canAll: (ps: readonly Permission[]) => ps.every((p) => granted.includes(p)),
    };
  }

  function setup(granted: Permission[]) {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: PermissionsService, useValue: fakePermissions(granted) },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(ProductListPage);
    fixture.detectChanges(); // dispara load()
    return fixture;
  }

  function flush(products: Partial<AdminProduct>[]) {
    httpMock.expectOne((r) => r.url.includes('/product') && r.params.get('all') === 'true').flush({
      msg: 'ok',
      data: products,
    });
    httpMock.expectOne((r) => r.url.endsWith('/category')).flush({ msg: 'ok', data: [] });
  }

  afterEach(() => httpMock.verify());

  const DRAFT: Partial<AdminProduct> = {
    _id: 'p1',
    name: 'Draft X',
    slug: 'draft-x',
    price: 1,
    stock: 1,
    isActive: false,
    status: 'DRAFT',
    categories: [],
    images: [],
    variants: [],
  };
  const PENDING: Partial<AdminProduct> = { ...DRAFT, _id: 'p2', name: 'Pending X', status: 'PENDING_REVIEW' };
  const APPROVED: Partial<AdminProduct> = { ...DRAFT, _id: 'p3', name: 'Approved X', status: 'APPROVED' };
  const PUBLISHED: Partial<AdminProduct> = { ...DRAFT, _id: 'p4', name: 'Published X', status: 'PUBLISHED', isActive: true };

  it('estado loading -> muestra skeleton (adm-data-table sin filas de datos)', () => {
    const f = setup(['products.read']);
    const cmp = f.componentInstance as any;
    // Antes de flush(), el estado sigue en 'loading' (adm-data-table renderiza
    // un esqueleto con forma de tabla, no la tabla real: no se compara DOM).
    expect(cmp.state()).toBe('loading');
    flush([DRAFT]);
  });

  it('estado empty -> sin productos', () => {
    const f = setup(['products.read']);
    flush([]);
    f.detectChanges();
    const cmp = f.componentInstance as any;
    expect(cmp.tableState()).toBe('empty');
  });

  it('estado error -> normaliza el mensaje', () => {
    const f = setup(['products.read']);
    // Se resuelve primero `/category` (éxito) y LUEGO se falla `/product`:
    // así ninguna de las dos queda pendiente cuando `forkJoin` propaga el
    // error (si se fallara primero, `forkJoin` cancelaría la request hermana
    // antes de poder flushearla, y `verify()` la reportaría como abierta).
    httpMock.expectOne((r) => r.url.endsWith('/category')).flush({ msg: 'ok', data: [] });
    httpMock.expectOne((r) => r.url.includes('/product')).flush('boom', { status: 500, statusText: 'Server Error' });
    f.detectChanges();
    const cmp = f.componentInstance as any;
    expect(cmp.tableState()).toBe('error');
    expect(cmp.errorMsg()).toBeTruthy();
  });

  it('editor: NUNCA ve aprobar/rechazar/publicar, y sí ve "Enviar a revisión" en DRAFT', () => {
    const f = setup(['products.read', 'products.create', 'products.update', 'products.submitReview']);
    flush([DRAFT, PENDING, APPROVED, PUBLISHED]);
    f.detectChanges();
    const cmp = f.componentInstance as any;

    expect(cmp.canSubmitReview(DRAFT)).toBe(true);
    expect(cmp.canApprove(PENDING)).toBe(false);
    expect(cmp.canReject(PENDING)).toBe(false);
    expect(cmp.canPublish(APPROVED)).toBe(false);
    expect(cmp.canToggleActive()).toBe(false);

    const html = f.nativeElement.textContent as string;
    expect(html).not.toContain('Aprobar');
    expect(html).not.toContain('Rechazar');
    expect(html).not.toContain('Publicar');
  });

  it('shop_manager: NUNCA aprueba/rechaza/publica, pero sí activa/desactiva y envía a revisión', () => {
    const f = setup([
      'products.read',
      'products.update',
      'products.delete',
      'products.submitReview',
      'products.toggleActive',
    ]);
    flush([DRAFT, PENDING, APPROVED]);
    f.detectChanges();
    const cmp = f.componentInstance as any;

    expect(cmp.canSubmitReview(DRAFT)).toBe(true);
    expect(cmp.canApprove(PENDING)).toBe(false);
    expect(cmp.canReject(PENDING)).toBe(false);
    expect(cmp.canPublish(APPROVED)).toBe(false);
    expect(cmp.canToggleActive()).toBe(true);
  });

  it('administrador: puede aprobar (PENDING_REVIEW) y publicar (APPROVED), respetando el estado', () => {
    const f = setup([
      'products.read',
      'products.update',
      'products.delete',
      'products.submitReview',
      'products.approve',
      'products.reject',
      'products.publish',
      'products.toggleActive',
    ]);
    flush([DRAFT, PENDING, APPROVED, PUBLISHED]);
    f.detectChanges();
    const cmp = f.componentInstance as any;

    expect(cmp.canApprove(PENDING)).toBe(true);
    expect(cmp.canReject(PENDING)).toBe(true);
    // No se puede aprobar un DRAFT ni publicar un PENDING_REVIEW: el permiso
    // no basta, el ESTADO del producto también debe admitir la transición.
    expect(cmp.canApprove(DRAFT)).toBe(false);
    expect(cmp.canPublish(PENDING)).toBe(false);
    expect(cmp.canPublish(APPROVED)).toBe(true);
  });

  it('aprobar llama a PATCH /product/:id/status con toStatus APPROVED', () => {
    const f = setup(['products.read', 'products.approve']);
    flush([PENDING]);
    f.detectChanges();
    const cmp = f.componentInstance as any;

    cmp.approve(PENDING);
    const req = httpMock.expectOne((r) => r.url.endsWith('/product/p2/status'));
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body.toStatus).toBe('APPROVED');
    req.flush({ msg: 'ok', data: { ...PENDING, status: 'APPROVED' } });
  });

  it('rechazar pide motivo y lo envía como rejectionReason', async () => {
    const f = setup(['products.read', 'products.reject']);
    flush([PENDING]);
    f.detectChanges();
    const cmp = f.componentInstance as any;

    const dialog = TestBed.inject(AdminDialog);
    vi.spyOn(dialog, 'promptText').mockResolvedValue('Faltan fotos');

    await cmp.reject(PENDING);
    const req = httpMock.expectOne((r) => r.url.endsWith('/product/p2/status'));
    expect(req.request.body).toEqual({ toStatus: 'REJECTED', rejectionReason: 'Faltan fotos' });
    req.flush({ msg: 'ok', data: { ...PENDING, status: 'REJECTED', rejectionReason: 'Faltan fotos' } });
  });

  it('rechazar cancelado (sin motivo) -> NO envía ninguna request', async () => {
    const f = setup(['products.read', 'products.reject']);
    flush([PENDING]);
    f.detectChanges();
    const cmp = f.componentInstance as any;

    const dialog = TestBed.inject(AdminDialog);
    vi.spyOn(dialog, 'promptText').mockResolvedValue(null);

    await cmp.reject(PENDING);
    httpMock.expectNone((r) => r.url.endsWith('/product/p2/status'));
  });
});
