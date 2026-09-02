import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  // Smoke test real (reemplaza al test scaffold de Angular que esperaba
  // "<h1>Hello, frontEND</h1>", eliminado del template hace tiempo).
  // Verifica la lógica que decide si se muestra el shell público (header/footer)
  // o el layout del Admin Panel.
  it('fuera de /admin muestra el shell público (isAdminRoute = false)', () => {
    const fixture = TestBed.createComponent(App);
    const cmp = fixture.componentInstance as unknown as { isAdminRoute: () => boolean };
    expect(cmp.isAdminRoute()).toBe(false);
  });
});
