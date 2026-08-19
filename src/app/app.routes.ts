import { Routes } from '@angular/router';
import { Home } from './features/home/home';
import { authGuard } from './core/guards/auth-guard';
// import { adminGuard } from './core/guards/admin.guard';

export const routes: Routes = [

     // ================= Rutas publicas ========== 

     { path: 'home', component: Home },

     {
          path: 'register',
          loadComponent: () => import('./features/auth/register/register')
     },

     {
          path: 'login',
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
          path: 'product-ropa',
          loadComponent: () => import('./features/product-disign/product-disign')
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


     // =============== Rutas privadas ==============

     {
          path: 'dashboard',
          // canActivate:[ authGuard ],
          loadComponent: () => import('./features/dashboard/dashboard'),
          children: [
     {
          path: 'category-new',
          loadComponent: () => import('./features/categories/category-new-form/category-new-form')
     },

     {
          path: 'category-edit/:id',
          canActivate: [ authGuard ],
          loadComponent: () => import('./features/categories/category-edit-form/category-edit-form')
     },

     {
          path: 'product-new',
          loadComponent: () => import('./features/products/product-new-form/product-new-form')
     },

     {
          path: 'product-edit/:id',
          loadComponent: () => import('./features/products/product-edit-form/product-edit-form')
     },

     {
          path: 'user/list',
          loadComponent: () => import('./features/users/user-list/user-list')
     },


     {
          path: 'product-list',
          loadComponent: () => import('./features/products/product-list/product-list')
     },

     {
          path: 'user-new',
          loadComponent: () => import('./features/users/user-new-form/user-new-form'),
     },


     {
          path: 'user-edit/:id',
          loadComponent: () =>
               import('./features/users/user-edit-form/user-edit-form')
     },
          ]
     },

     //Redirecciones
     { path: '', redirectTo: 'home', pathMatch: 'full' },
     { path: '**', redirectTo: '404', pathMatch: 'full' },

];
