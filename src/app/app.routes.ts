import { Routes } from '@angular/router';
import { Home } from './features/home/home';
// import { adminGuard } from './core/guards/admin.guard';

export const routes: Routes = [

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
          path: 'category-new',
          loadComponent: () => import('./features/categories/category-new-form/category-new-form')
     },

     {
          path: 'category-list',
          loadComponent: () => import('./features/categories/category-list/category-list')
     },

     {
          path: '404',
          loadComponent: () => import('./features/page-not-foud/page-not-foud')
     },

     {
          path: 'dashboard',
          loadComponent: () => import('./features/dashboard/dashboard')
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
          path: 'dashboard/user/list',
          loadComponent: () => import('./features/users/user-list/user-list')
     },
     {
          path: 'dashboard/user-new',
          loadComponent: () => import('./features/users/user-new-form/user-new-form'),
     },
     {
          path: 'deshboard/user-edit:id',
          loadComponent: () =>
               import('./features/users/user-edit-form/user-edit-form')
     },
     {
          path: 'dashboard/category-edit/:id',
          loadComponent: () => import('./features/categories/category-edit-form/category-edit-form')
     },

     {
          path: 'dashboard/product-new',
          loadComponent: () => import('./features/products/product-new-form/product-new-form')
     },

     {
          path: 'dashboard/product-list',
          loadComponent: () => import('./features/products/product-list/product-list')
     },

     {
          path: 'dashboard/product-edit/:id',
          loadComponent: () => import('./features/products/product-edit-form/product-edit-form')
     },

     //Redirecciones
     { path: '', redirectTo: 'home', pathMatch: 'full' },
     { path: '**', redirectTo: '404', pathMatch: 'full' },

];
