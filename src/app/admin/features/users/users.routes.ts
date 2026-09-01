import { Routes } from '@angular/router';

import { unsavedChangesGuard } from '../../core/guards/unsaved-changes.guard';

export const USERS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./user-list.page'),
  },
  {
    path: 'new',
    loadComponent: () => import('./user-form.page'),
    canDeactivate: [unsavedChangesGuard],
    data: { breadcrumb: 'Nuevo' },
  },
  {
    path: ':id/edit',
    loadComponent: () => import('./user-form.page'),
    canDeactivate: [unsavedChangesGuard],
    data: { breadcrumb: 'Editar' },
  },
  {
    path: ':id',
    loadComponent: () => import('./user-detail.page'),
    data: { breadcrumb: 'Detalle' },
  },
];
