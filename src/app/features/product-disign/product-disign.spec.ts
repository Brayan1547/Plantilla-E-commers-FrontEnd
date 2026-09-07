import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, ActivatedRoute, convertToParamMap } from '@angular/router';

import ProductDisign from './product-disign';

/**
 * R2.3 — Ficha pública de producto (`tienda/producto/:id`). Carga el producto
 * REAL con `GET /api/product/:id`. Maneja: válido · no encontrado · id inválido · error.
 */
describe('ProductDisign (product detail)', () => {
  let httpMock: HttpTestingController;
  const VALID_ID = 'a'.repeat(24);

  function setup(id: string | null) {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap(id ? { id } : {}) } },
        },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(ProductDisign);
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => httpMock.verify());

  it('producto válido -> estado "ready" con datos reales', () => {
    const f = setup(VALID_ID);
    httpMock.expectOne((r) => r.url.endsWith(`/product/${VALID_ID}`)).flush({
      msg: 'ok',
      data: { _id: VALID_ID, name: 'Camiseta Negra', price: 89000, stock: 4, description: 'x', images: [] },
    });
    const cmp = f.componentInstance as any;
    expect(cmp.state()).toBe('ready');
    expect(cmp.product().name).toBe('Camiseta Negra');
    expect(cmp.outOfStock()).toBe(false);
  });

  it('respuesta con data vacía -> "not-found"', () => {
    const f = setup(VALID_ID);
    httpMock.expectOne((r) => r.url.endsWith(`/product/${VALID_ID}`)).flush({ msg: 'no existe', data: null });
    expect((f.componentInstance as any).state()).toBe('not-found');
  });

  it('id con forma inválida -> "not-found" SIN llamar a la API', () => {
    const f = setup('123-no-objectid');
    httpMock.expectNone(() => true);
    expect((f.componentInstance as any).state()).toBe('not-found');
  });

  it('404 del backend -> "not-found"', () => {
    const f = setup(VALID_ID);
    httpMock
      .expectOne((r) => r.url.endsWith(`/product/${VALID_ID}`))
      .flush({ msg: 'no encontrado' }, { status: 404, statusText: 'Not Found' });
    expect((f.componentInstance as any).state()).toBe('not-found');
  });

  it('500 del backend -> "error"', () => {
    const f = setup(VALID_ID);
    httpMock
      .expectOne((r) => r.url.endsWith(`/product/${VALID_ID}`))
      .flush('boom', { status: 500, statusText: 'Server Error' });
    expect((f.componentInstance as any).state()).toBe('error');
  });

  it('stock 0 -> outOfStock true', () => {
    const f = setup(VALID_ID);
    httpMock.expectOne((r) => r.url.endsWith(`/product/${VALID_ID}`)).flush({
      msg: 'ok',
      data: { _id: VALID_ID, name: 'Agotada', price: 1, stock: 0, images: [] },
    });
    expect((f.componentInstance as any).outOfStock()).toBe(true);
  });

  // ---- F7-E — campos públicos ampliados ------------------------------------

  it('F7-E · muestra details/shippingInfo/returnsInfo reales cuando el backend los manda', () => {
    const f = setup(VALID_ID);
    httpMock.expectOne((r) => r.url.endsWith(`/product/${VALID_ID}`)).flush({
      msg: 'ok',
      data: {
        _id: VALID_ID,
        name: 'Camiseta Negra',
        price: 89000,
        stock: 4,
        images: [],
        details: 'Composición 100% algodón orgánico.',
        shippingInfo: 'Envío express 24h en Bogotá.',
        returnsInfo: 'Cambios sin costo dentro de 15 días.',
      },
    });
    f.detectChanges();
    const text = f.nativeElement.textContent as string;
    expect(text).toContain('Composición 100% algodón orgánico.');
    expect(text).toContain('Envío express 24h en Bogotá.');
    expect(text).toContain('Cambios sin costo dentro de 15 días.');
    // el texto genérico anterior ya NO debe verse cuando hay dato real
    expect(text).not.toContain('Envíos nacionales a toda Colombia de 2 a 5 días hábiles.');
  });

  it('F7-E · sin shippingInfo/returnsInfo del backend -> conserva el texto genérico existente', () => {
    const f = setup(VALID_ID);
    httpMock.expectOne((r) => r.url.endsWith(`/product/${VALID_ID}`)).flush({
      msg: 'ok',
      data: { _id: VALID_ID, name: 'Legacy', price: 1, stock: 1, images: [] },
    });
    f.detectChanges();
    const text = f.nativeElement.textContent as string;
    expect(text).toContain('Envíos nacionales a toda Colombia de 2 a 5 días hábiles.');
    expect(text).toContain('Cambios y devoluciones dentro de 30 días desde la entrega.');
  });

  it('F7-E · modelInfo con talla y heightCm -> etiqueta legible en centímetros (sin conversión a metros)', () => {
    const f = setup(VALID_ID);
    httpMock.expectOne((r) => r.url.endsWith(`/product/${VALID_ID}`)).flush({
      msg: 'ok',
      data: { _id: VALID_ID, name: 'X', price: 1, stock: 1, images: [], modelInfo: { size: 'S', heightCm: 187 } },
    });
    const cmp = f.componentInstance as any;
    expect(cmp.modelInfoLabel()).toBe('Modelo: talla S, 187 cm de estatura');
  });

  it('F7-E · sin modelInfo -> modelInfoLabel null (no se renderiza nada)', () => {
    const f = setup(VALID_ID);
    httpMock.expectOne((r) => r.url.endsWith(`/product/${VALID_ID}`)).flush({
      msg: 'ok',
      data: { _id: VALID_ID, name: 'X', price: 1, stock: 1, images: [] },
    });
    expect((f.componentInstance as any).modelInfoLabel()).toBeNull();
  });

  it('F7-E · categories poblado ({name,slug}) se muestra como etiquetas de texto', () => {
    const f = setup(VALID_ID);
    httpMock.expectOne((r) => r.url.endsWith(`/product/${VALID_ID}`)).flush({
      msg: 'ok',
      data: {
        _id: VALID_ID,
        name: 'X',
        price: 1,
        stock: 1,
        images: [],
        categories: [{ _id: 'c1', name: 'Hombre', slug: 'hombre' }],
      },
    });
    f.detectChanges();
    const cmp = f.componentInstance as any;
    expect(cmp.categoryNames()).toEqual(['Hombre']);
    expect((f.nativeElement.textContent as string)).toContain('Hombre');
  });

  // ---- F7-F — variantes: informativas, NUNCA conectadas al carrito ---------

  it('F7-F · variantes muestran color/talla/disponibilidad; SKU nunca llega (el backend no lo manda)', () => {
    const f = setup(VALID_ID);
    httpMock.expectOne((r) => r.url.endsWith(`/product/${VALID_ID}`)).flush({
      msg: 'ok',
      data: {
        _id: VALID_ID,
        name: 'X',
        price: 1,
        stock: 5,
        images: [],
        variants: [
          { color: 'Negro', size: 'M', stock: 5 },
          { color: 'Negro', size: 'L', stock: 0 },
        ],
      },
    });
    f.detectChanges();
    const cmp = f.componentInstance as any;
    expect(cmp.hasVariants()).toBe(true);
    expect(cmp.variants().length).toBe(2);
    expect(cmp.variants().every((v: any) => !('sku' in v))).toBe(true);
    const text = f.nativeElement.textContent as string;
    expect(text).toContain('Negro');
    expect(text).toContain('Disponible');
    expect(text).toContain('Agotado');
  });

  it('F7-F · sin variants[] -> hasVariants false, sección no se renderiza', () => {
    const f = setup(VALID_ID);
    httpMock.expectOne((r) => r.url.endsWith(`/product/${VALID_ID}`)).flush({
      msg: 'ok',
      data: { _id: VALID_ID, name: 'X', price: 1, stock: 1, images: [] },
    });
    f.detectChanges();
    const cmp = f.componentInstance as any;
    expect(cmp.hasVariants()).toBe(false);
    expect((f.nativeElement.textContent as string)).not.toContain('Disponible en:');
  });

  it('F7-F · addToCart con variantes presentes sigue enviando SOLO {productId, quantity} — sin variantId/color/size/sku', () => {
    const f = setup(VALID_ID);
    httpMock.expectOne((r) => r.url.endsWith(`/product/${VALID_ID}`)).flush({
      msg: 'ok',
      data: {
        _id: VALID_ID,
        name: 'X',
        price: 1,
        stock: 5,
        images: [],
        variants: [{ color: 'Negro', size: 'M', stock: 5 }],
      },
    });
    const cmp = f.componentInstance as any;
    // simula sesión activa (setter público real de HttpAuth) para no desviar a la modal de login
    cmp.auth.user = { _id: 'u1', role: 'subscriber' };

    cmp.addToCart();
    const req = httpMock.expectOne((r) => r.method === 'PATCH' && r.url.endsWith('/cart'));
    expect(req.request.body).toEqual({ productId: VALID_ID, quantity: 1 });
    expect(Object.keys(req.request.body).sort()).toEqual(['productId', 'quantity']);
    req.flush({ msg: 'ok', data: { items: [] } });
  });
});
