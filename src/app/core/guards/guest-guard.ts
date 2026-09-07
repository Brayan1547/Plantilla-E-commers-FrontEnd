import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { HttpAuth } from '../services/http-auth';

import { tap, map } from 'rxjs';

// F3: `editor` también tiene panel (UI editorial de productos en `/admin`).
const PANEL_ROLES = ['administrador', 'shop_manager', 'editor'];

export const guestGuard: CanActivateFn = (route, state) => {
  const httpAuth = inject( HttpAuth );
  const router = inject( Router );

  //implementacion de la renovacion de token
  return httpAuth.checkAuthStatus().pipe(
    map( ( isAutenticanted ) => !isAutenticanted ),
    tap( ( isGuest ) => {
      //si YA hay sesion, no dejamos ver login/register: se redirige segun el rol
      if( !isGuest ) {
        const role = httpAuth.user?.role;
        router.navigateByUrl( PANEL_ROLES.includes(role) ? '/admin' : '/home' );
      }
    }),
  )
};
