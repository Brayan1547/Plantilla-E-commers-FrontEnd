import { Routes } from '@angular/router';
import { Home } from './features/home/home';

export const routes: Routes = [
     { path: 'home', component: Home },

     {
          path: 'login',
          loadComponent: () => import('./features/login/login')
     },

     {
          path: 'register',
          loadComponent: () => import('./features/register/register')
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
          path: 'user/list',
          loadComponent: () => import('./features/users/user-list/user-list')
     },

     {
          path: 'category-edit/:id',
          loadComponent: () => import('./features/categories/category-edit-form/category-edit-form')
     },

     {
          path: 'product-new',
          loadComponent: () => import('./features/products/product-new-form/product-new-form')
     },

     {
          path: 'product-list',
          loadComponent: () => import('./features/products/product-list/product-list')
     },

     {
          path: 'product-edit',
          loadComponent: () => import('./features/products/product-edit-form/product-edit-form')
     },

     //Redirecciones
     { path: '', redirectTo: 'home', pathMatch: 'full' },
     { path: '**', redirectTo: '404', pathMatch: 'full' }

];
