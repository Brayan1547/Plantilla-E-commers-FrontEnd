import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { Home } from './home';

/**
 * F7-D — "Recién llegados" en Home.
 *
 * Antes de F7: la sección mostraba TODO el catálogo activo (sin ordenar ni
 * recortar) y pintaba el tag "Nuevo" incondicionalmente en cada card — ver
 * F7.AUDIT §6. Esta suite cubre el contrato nuevo: orden por `publishedAt`
 * (nunca `createdAt`/`updatedAt`), límite razonable, tag "Nuevo" ligado a una
 * ventana real, y los estados que antes no existían (vacío/error).
 */
describe('Home (storefront)', () => {
  let httpMock: HttpTestingController;

  const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

  function setup() {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    httpMock = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(Home);
    fixture.detectChanges(); // dispara ngOnInit
    return fixture;
  }

  function flush(products: unknown[]) {
    httpMock.expectOne((r) => r.url.endsWith('/product')).flush({ msg: 'ok', data: products });
  }

  afterEach(() => httpMock.verify());

  it('F7-D · ordena "Recién llegados" por publishedAt, más reciente primero', () => {
    const f = setup();
    flush([
      { _id: 'old', name: 'Viejo', price: 1, stock: 1, isActive: true, images: [], publishedAt: daysAgo(20) },
      { _id: 'newest', name: 'Recién publicado', price: 1, stock: 1, isActive: true, images: [], publishedAt: daysAgo(1) },
      { _id: 'mid', name: 'Intermedio', price: 1, stock: 1, isActive: true, images: [], publishedAt: daysAgo(10) },
    ]);
    const cmp = f.componentInstance as any;
    expect(cmp.newArrivals().map((p: any) => p._id)).toEqual(['newest', 'mid', 'old']);
  });

  it('F7-D · límite razonable: no muestra más de 8 productos aunque el catálogo tenga más', () => {
    const f = setup();
    const products = Array.from({ length: 15 }, (_, i) => ({
      _id: `p${i}`,
      name: `Producto ${i}`,
      price: 1,
      stock: 1,
      isActive: true,
      images: [],
      publishedAt: daysAgo(i),
    }));
    flush(products);
    const cmp = f.componentInstance as any;
    expect(cmp.newArrivals().length).toBe(8);
    // siguen siendo los 8 más recientes (menor "daysAgo" primero)
    expect(cmp.newArrivals().map((p: any) => p._id)).toEqual(['p0', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7']);
  });

  it('F7-D · producto publicado hace más de 30 días NO se marca como "Nuevo"', () => {
    const f = setup();
    flush([
      { _id: 'old', name: 'Viejo', price: 1, stock: 1, isActive: true, images: [], publishedAt: daysAgo(45) },
      { _id: 'fresh', name: 'Fresco', price: 1, stock: 1, isActive: true, images: [], publishedAt: daysAgo(2) },
    ]);
    const cmp = f.componentInstance as any;
    const old = cmp.newArrivals().find((p: any) => p._id === 'old');
    const fresh = cmp.newArrivals().find((p: any) => p._id === 'fresh');
    expect(cmp.isNew(old)).toBe(false);
    expect(cmp.isNew(fresh)).toBe(true);
  });

  it('F7-D · producto sin publishedAt (dato legacy) no aparece en Recién llegados ni se marca Nuevo', () => {
    const f = setup();
    flush([{ _id: 'legacy', name: 'Legacy', price: 1, stock: 1, isActive: true, images: [] }]);
    const cmp = f.componentInstance as any;
    expect(cmp.newArrivals().length).toBe(0);
    expect(cmp.isNew({ _id: 'legacy' } as any)).toBe(false);
  });

  it('F7-D · productos publicados correctamente listados (catálogo público ya filtrado por el backend)', () => {
    const f = setup();
    flush([
      { _id: 'a', name: 'A', price: 1, stock: 1, isActive: true, images: [], publishedAt: daysAgo(1) },
      { _id: 'b', name: 'B', price: 1, stock: 1, isActive: true, images: [], publishedAt: daysAgo(2) },
    ]);
    const cmp = f.componentInstance as any;
    expect(cmp.state()).toBe('ready');
    expect(cmp.newArrivals().length).toBe(2);
  });

  it('F7-D · catálogo vacío -> estado "empty", sin cards ni error', () => {
    const f = setup();
    flush([]);
    f.detectChanges();
    const cmp = f.componentInstance as any;
    expect(cmp.state()).toBe('empty');
    expect(cmp.newArrivals().length).toBe(0);
    expect(f.nativeElement.textContent).toContain('Todavía no hay productos publicados');
  });

  it('F7-D · error del backend -> estado "error", mensaje visible', () => {
    const f = setup();
    httpMock.expectOne((r) => r.url.endsWith('/product')).flush('boom', { status: 500, statusText: 'Server Error' });
    const cmp = f.componentInstance as any;
    expect(cmp.state()).toBe('error');
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('No pudimos cargar los productos');
  });
});
