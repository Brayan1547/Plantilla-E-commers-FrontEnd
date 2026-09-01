import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';

import { AdminDialog } from '../services/admin-dialog';

export interface HasUnsavedChanges {
  /** true si hay cambios sin guardar que se perderían al salir. */
  hasUnsavedChanges(): boolean;
}

/**
 * Advierte antes de abandonar un formulario con cambios sin guardar.
 * El componente debe implementar `HasUnsavedChanges`.
 */
export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = (component) => {
  if (!component?.hasUnsavedChanges?.()) return true;
  return inject(AdminDialog).confirmDiscard();
};
