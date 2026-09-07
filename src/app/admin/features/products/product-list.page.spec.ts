import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
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

  function fakePermissions(granted: Permission[], role: string) {
    return {
      role: () => role,
      can: (p: Permission) => granted.includes(p),
      canAny: (ps: readonly Permission[]) => ps.some((p) => granted.includes(p)),
      canAll: (ps: readonly Permission[]) => ps.every((p) => granted.includes(p)),
    };
  }

  function setup(granted: Permission[], opts: { role?: string; queryParams?: Record<string, string> } = {}) {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: PermissionsService, useValue: fakePermissions(granted, opts.role ?? 'administrador') },
        // F6 — deep-link `?status=PENDING_REVIEW`: solo se necesita `snapshot.queryParamMap`.
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(opts.queryParams ?? {}) } },
        },
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
    expect(cmp.canRequestChanges(PENDING)).toBe(false);
    expect(cmp.canReject(PENDING)).toBe(false);
    expect(cmp.canPublish(APPROVED)).toBe(false);
    expect(cmp.canToggleActive()).toBe(false);

    const html = f.nativeElement.textContent as string;
    expect(html).not.toContain('Aprobar');
    expect(html).not.toContain('Solicitar cambios');
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
    expect(cmp.canRequestChanges(PENDING)).toBe(false);
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
      'products.requestChanges',
      'products.reject',
      'products.publish',
      'products.toggleActive',
    ]);
    flush([DRAFT, PENDING, APPROVED, PUBLISHED]);
    f.detectChanges();
    const cmp = f.componentInstance as any;

    expect(cmp.canApprove(PENDING)).toBe(true);
    expect(cmp.canRequestChanges(PENDING)).toBe(true);
    expect(cmp.canReject(PENDING)).toBe(true);
    // No se puede aprobar un DRAFT ni publicar un PENDING_REVIEW: el permiso
    // no basta, el ESTADO del producto también debe admitir la transición.
    expect(cmp.canApprove(DRAFT)).toBe(false);
    expect(cmp.canRequestChanges(DRAFT)).toBe(false);
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

  // F6 — `AdminProductsApi.updateStatus` envía el comentario como `comment`
  // (campo canónico del backend, `productWorkflow.helper.js`); `rejectionReason`
  // sigue existiendo ahí solo como alias de compatibilidad de entrada.
  it('rechazar pide motivo y lo envía como comment', async () => {
    const f = setup(['products.read', 'products.reject']);
    flush([PENDING]);
    f.detectChanges();
    const cmp = f.componentInstance as any;

    const dialog = TestBed.inject(AdminDialog);
    vi.spyOn(dialog, 'promptText').mockResolvedValue('Faltan fotos');

    await cmp.reject(PENDING);
    const req = httpMock.expectOne((r) => r.url.endsWith('/product/p2/status'));
    expect(req.request.body).toEqual({ toStatus: 'REJECTED', comment: 'Faltan fotos' });
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

  // ---- F6 — Admin Review ---------------------------------------------------

  it('F6 · solicitar cambios pide comentario y envía CHANGES_REQUESTED + comment', async () => {
    const f = setup(['products.read', 'products.requestChanges']);
    flush([PENDING]);
    f.detectChanges();
    const cmp = f.componentInstance as any;

    const dialog = TestBed.inject(AdminDialog);
    vi.spyOn(dialog, 'promptText').mockResolvedValue('Ajusta las tallas');

    await cmp.requestChanges(PENDING);
    const req = httpMock.expectOne((r) => r.url.endsWith('/product/p2/status'));
    expect(req.request.body).toEqual({ toStatus: 'CHANGES_REQUESTED', comment: 'Ajusta las tallas' });
    req.flush({ msg: 'ok', data: { ...PENDING, status: 'CHANGES_REQUESTED' } });
  });

  it('F6 · solicitar cambios cancelado (sin comentario) -> NO envía ninguna request', async () => {
    const f = setup(['products.read', 'products.requestChanges']);
    flush([PENDING]);
    f.detectChanges();
    const cmp = f.componentInstance as any;

    const dialog = TestBed.inject(AdminDialog);
    vi.spyOn(dialog, 'promptText').mockResolvedValue(null);

    await cmp.requestChanges(PENDING);
    httpMock.expectNone((r) => r.url.endsWith('/product/p2/status'));
  });

  it('F6 · atajo "pendientes de revisión": visible para admin/shop_manager, cuenta correctamente y filtra al click', () => {
    const f = setup(['products.read'], { role: 'administrador' });
    flush([DRAFT, PENDING, APPROVED]);
    f.detectChanges();
    const cmp = f.componentInstance as any;

    expect(cmp.canSeeReviewShortcut()).toBe(true);
    expect(cmp.pendingReviewCount()).toBe(1);

    cmp.goToPendingReview();
    expect(cmp.statusFilter()).toBe('PENDING_REVIEW');
  });

  it('F6 · atajo "pendientes de revisión": oculto para editor', () => {
    const f = setup(['products.read', 'products.submitReview'], { role: 'editor' });
    flush([PENDING]);
    f.detectChanges();
    const cmp = f.componentInstance as any;

    expect(cmp.canSeeReviewShortcut()).toBe(false);
    expect(f.nativeElement.textContent).not.toContain('pendiente');
  });

  it('F6 · deep-link ?status=PENDING_REVIEW preselecciona el filtro de estado', () => {
    const f = setup(['products.read'], { queryParams: { status: 'PENDING_REVIEW' } });
    flush([DRAFT, PENDING]);
    f.detectChanges();
    const cmp = f.componentInstance as any;

    expect(cmp.statusFilter()).toBe('PENDING_REVIEW');
  });

  it('F6 · deep-link con un status inválido se ignora (filtro sigue vacío)', () => {
    const f = setup(['products.read'], { queryParams: { status: 'NO_EXISTE' } });
    flush([DRAFT]);
    f.detectChanges();
    const cmp = f.componentInstance as any;

    expect(cmp.statusFilter()).toBe('');
  });

  it('F6 · creatorName lee `createdBy` populado ({name}); null si llega como ObjectId crudo', () => {
    const f = setup(['products.read']);
    const withCreator = { ...PENDING, createdBy: { _id: 'u1', name: 'Editor A' } };
    const withoutPopulate = { ...DRAFT, createdBy: '507f1f77bcf86cd799439011' };
    flush([withCreator, withoutPopulate]);
    f.detectChanges();
    const cmp = f.componentInstance as any;

    expect(cmp.creatorName(withCreator)).toBe('Editor A');
    expect(cmp.creatorName(withoutPopulate)).toBeNull();
  });

  // ---- F3 -----------------------------------------------------------------

  const CHANGES: Partial<AdminProduct> = {
    ...DRAFT,
    _id: 'p5',
    name: 'Changes X',
    status: 'CHANGES_REQUESTED',
    workflowHistory: [
      { action: 'request_changes', fromStatus: 'PENDING_REVIEW', toStatus: 'CHANGES_REQUESTED', comment: 'Ajusta las fotos' },
    ],
  };
  const REJECTED: Partial<AdminProduct> = {
    ...DRAFT, _id: 'p6', name: 'Rejected X', status: 'REJECTED', rejectionReason: 'No cumple la línea',
  };
  const ARCHIVED: Partial<AdminProduct> = { ...DRAFT, _id: 'p7', name: 'Archived X', status: 'ARCHIVED' };

  it('F3 · editor: "Enviar a revisión" disponible en CHANGES_REQUESTED (arista directa), no en REJECTED', () => {
    const f = setup(['products.read', 'products.update', 'products.submitReview']);
    flush([CHANGES, REJECTED, ARCHIVED]);
    f.detectChanges();
    const cmp = f.componentInstance as any;

    expect(cmp.canSubmitReview(CHANGES)).toBe(true);
    expect(cmp.canSubmitReview(REJECTED)).toBe(false);
    expect(cmp.canSubmitReview(ARCHIVED)).toBe(false);
    // acciones administrativas siguen vetadas
    expect(cmp.canApprove(CHANGES)).toBe(false);
    expect(cmp.canPublish(ARCHIVED)).toBe(false);
  });

  it('F3 · reviewNote: comentario de workflowHistory (CHANGES) y rejectionReason (REJECTED)', () => {
    const f = setup(['products.read']);
    flush([CHANGES, REJECTED, DRAFT]);
    f.detectChanges();
    const cmp = f.componentInstance as any;

    expect(cmp.reviewNote(CHANGES)).toBe('Ajusta las fotos');
    expect(cmp.reviewNote(REJECTED)).toBe('No cumple la línea');
    expect(cmp.reviewNote(DRAFT)).toBeNull();
  });

  it('F3 · "Enviar a revisión" en CHANGES_REQUESTED -> PATCH /status PENDING_REVIEW', () => {
    const f = setup(['products.read', 'products.submitReview']);
    flush([CHANGES]);
    f.detectChanges();
    const cmp = f.componentInstance as any;

    cmp.submitReview(CHANGES);
    const req = httpMock.expectOne((r) => r.url.endsWith('/product/p5/status'));
    expect(req.request.body.toStatus).toBe('PENDING_REVIEW');
    req.flush({ msg: 'ok', data: { ...CHANGES, status: 'PENDING_REVIEW' } });
  });
});
