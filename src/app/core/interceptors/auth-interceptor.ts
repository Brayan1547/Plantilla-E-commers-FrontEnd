import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import {  HttpAuth } from '../services/http-auth';
import { catchError, throwError } from 'rxjs';
import { Router } from '@angular/router';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const httpAuth  = inject( HttpAuth );
  const router = inject( Router );

  //(1) obtener el token
  const token = httpAuth.token;

  let requestHeadersToken = req;

  //validamos si el token existe
  if (token) {
    //(2)creamos el Header (cabecera) y agregamos el token en la propiedad "x/token"
    requestHeadersToken = req.clone({
      headers: req.headers
      .set( 'x-token', token)                       //Estamos enviando el token en una cabecera
      .set( 'x-procesado-por', 'authInterceptor')   //Para reconocer quien esta creando la cabecera
    })
  }

  //(3) Envia cabecera con o sin token al siguiente Interceptor
  return next( requestHeadersToken ).pipe(
    catchError( (error: HttpErrorResponse) => {
      if ( error.status == 401 ) {
        //(1) Eliminar los datos que tengo almacenados en mi LocalStorage (token, userData)
        httpAuth.clearAuthData();
        //(2) Redirecciona -- salvo que ya estemos en una pantalla de auth
        const onAuthPage = /\/login|\/register/.test(router.url);
        if (!onAuthPage) {
          router.navigate(['/login'], { queryParams: { returnUrl: router.url } });
        }
      }

      // Propagamos el error REAL (status + body) para que los componentes
      // puedan mostrar estados de error/reintento. Antes se emitia `{}`, lo que
      // dejaba a los callbacks `error:` sin informacion.
      return throwError( () => error );
    })
  )
};
