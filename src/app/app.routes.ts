import { Routes } from '@angular/router';

import { Home } from './features/home/home';



export const routes: Routes = [
    { path: 'home', component: Home },

    { path: 'login', loadComponent: () => import('./features/login/login').then(m => m.Login) },
    
    { path: 'register', loadComponent: () => import('./features/register/register').then(m => m.Register) },

    { path: 'checkout', loadComponent: () => import('./features/checkout/checkout').then(m => m.Checkout) },

    {path: 'category-new', loadComponent:() => import('./features/categories/category-new-form/category-new-form').then(m => m.CategoryNewForm)},

    {path: 'product-new', loadComponent:() => import('./features/products/product-new-form/product-new-form').then(m =>m.ProductNewForm)},

    { path: '404', loadComponent: () => import('./features/page-not-foud/page-not-foud').then(m => m.PageNotFoud) },

    { path: 'product/detalls', loadComponent: () => import('./features/products/product-detalls/product-detalls').then(m => m.ProductDetalls) },

    { path: 'user/list', loadComponent: () => import('./features/users/user-list/user-list').then(m => m.UserList) },

    { path: '', redirectTo: 'home', pathMatch: 'full' },
    { path: '**', redirectTo: '404', pathMatch: 'full' }

];
