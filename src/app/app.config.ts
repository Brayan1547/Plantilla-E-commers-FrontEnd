import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideClientHydration } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { loggerInterceptor } from './core/interceptors/logger-interceptor';
import { authInterceptor } from './core/interceptors/auth-interceptor';



export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideClientHydration(),
    provideHttpClient( 
      //Define que interceptor queda conectado ala aplicacion
      withInterceptors([ authInterceptor, loggerInterceptor ])
    )
  ]
};
