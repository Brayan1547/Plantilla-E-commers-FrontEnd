import { Routes } from '@angular/router';

import { unsavedChangesGuard } from '../../core/guards/unsaved-changes.guard';

export const DEBTS_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./debt-list.page') },
  {
    path: 'new',
    loadComponent: () => import('./debt-form.page'),
    canDeactivate: [unsavedChangesGuard],
    data: { breadcrumb: 'Nueva' },
  },
  {
    path: ':id/edit',
    loadComponent: () => import('./debt-form.page'),
    canDeactivate: [unsavedChangesGuard],
    data: { breadcrumb: 'Editar' },
  },
  {
    path: ':id',
    loadComponent: () => import('./debt-detail.page'),
    data: { breadcrumb: 'Detalle' },
  },
];
