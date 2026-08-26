import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { HttpAuth } from '../services/http-auth';

import { tap, map } from 'rxjs';

export const guestGuard: CanActivateFn = (route, state) => {
  const httpAuth = inject( HttpAuth );
  const router = inject( Router );

  //implementacion de la renovacion de token
  return httpAuth.checkAuthStatus().pipe(
    map( ( isAutenticanted ) => !isAutenticanted ),
    tap( ( isAutenticanted ) => {
      //verificamos si esta autenticado
      if( !isAutenticanted) {
        router.navigateByUrl( '/dashboard' )
      }
    }),
  )
};
