import { Routes } from '@angular/router';

import { unsavedChangesGuard } from '../../core/guards/unsaved-changes.guard';

export const PRODUCTS_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./product-list.page') },
  {
    path: 'new',
    loadComponent: () => import('./product-form.page'),
    canDeactivate: [unsavedChangesGuard],
    data: { breadcrumb: 'Nuevo' },
  },
  {
    path: ':id/edit',
    loadComponent: () => import('./product-form.page'),
    canDeactivate: [unsavedChangesGuard],
    data: { breadcrumb: 'Editar' },
  },
];
