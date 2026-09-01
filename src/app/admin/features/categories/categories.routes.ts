import { Routes } from '@angular/router';

import { unsavedChangesGuard } from '../../core/guards/unsaved-changes.guard';

export const CATEGORIES_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./category-list.page') },
  {
    path: 'new',
    loadComponent: () => import('./category-form.page'),
    canDeactivate: [unsavedChangesGuard],
    data: { breadcrumb: 'Nueva' },
  },
  {
    path: ':id/edit',
    loadComponent: () => import('./category-form.page'),
    canDeactivate: [unsavedChangesGuard],
    data: { breadcrumb: 'Editar' },
  },
];
