import { HttpInterceptorFn } from '@angular/common/http';

export const loggerInterceptor: HttpInterceptorFn = (req, next) => {

  console.group();                //Solo agrupa mensajes
  console.log( req.method );      //GET, POST, PATCH
  console.log( req.url );         //http://localhost:3000/api/users
  console.groupEnd();


  return next(req);
};
