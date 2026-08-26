import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { HttpAuth } from '../services/http-auth';
import { tap } from 'rxjs';

export const authGuard: CanActivateFn = (route, state) => {
  const httpAuth = inject( HttpAuth);
  const router = inject( Router);

  //Implementacion de la renovacion del token
  return httpAuth.checkAuthStatus().pipe(
    tap( ( isAutenticanted ) => {
      if( !isAutenticanted ) {
        router.navigate( ['/login'] );
      }
    })
  );
};
