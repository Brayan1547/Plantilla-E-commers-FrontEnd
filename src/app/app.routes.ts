import { Routes } from '@angular/router';
import { Home } from './features/home/home';
import { guestGuard } from './core/guards/guest-guard';
// import { adminGuard } from './core/guards/admin.guard';

export const routes: Routes = [

     // ================= Rutas publicas ========== 

     { path: 'home', component: Home },

     {
          path: 'register',
          canActivate:[guestGuard],
          loadComponent: () => import('./features/auth/register/register')
     },

     {
          path: 'login',
          canActivate:[guestGuard],
          loadComponent: () => import('./features/auth/login/login')
     },

     {
          path: 'checkout',
          loadComponent: () => import('./features/checkout/checkout')
     },

      {
          path: 'category-list',
          loadComponent: () => import('./features/categories/category-list/category-list')
     },

      {
          // BÁSICOS: catálogo público permanente, clasificado por categoría.
          path: 'basicos',
          loadComponent: () => import('./features/basicos/basicos')
     },

      {
          // COLECCIONES: seccion publica de lanzamientos especiales (concepto).
          path: 'colecciones',
          loadComponent: () => import('./features/colecciones/colecciones')
     },

          {
          // ficha de un producto, ":id" recibe el _id de Mongo desde la URL
          path: 'tienda/producto/:id',
          loadComponent: () => import('./features/product-disign/product-disign')
     },
     {
          // "/tienda" sola aún no tiene vista propia, por ahora manda a home
          path: 'tienda',
          redirectTo: 'home',
          pathMatch: 'full'
     },

     {
          path: '404',
          loadComponent: () => import('./features/page-not-foud/page-not-foud')
     },


     // =============== Admin Panel (nuevo) ==============
     // Panel privado con su propio layout, guards y design system.
     // Render CSR (ver app.routes.server.ts): datos autenticados, sin SEO.
     {
          path: 'admin',
          loadChildren: () => import('./admin/admin.routes').then((m) => m.ADMIN_ROUTES),
     },

     // El legacy /dashboard y sus formularios administrativos fueron retirados en
     // R2.2. La gestion de productos/categorias/usuarios vive solo en /admin.
     // Cualquier URL antigua /dashboard/* cae en el comodin -> /404 (controlado).

     //Redirecciones
     { path: '', redirectTo: 'home', pathMatch: 'full' },
     { path: '**', redirectTo: '404', pathMatch: 'full' },

];
