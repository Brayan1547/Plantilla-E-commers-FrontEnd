import { HttpClient, HttpErrorResponse } from "@angular/common/http";
import { inject, PLATFORM_ID, Service } from "@angular/core";
import { Router } from "@angular/router";

import { BehaviorSubject, catchError, map, of, tap } from "rxjs";

import { environment } from "../../../environments/environment";
import { isPlatformBrowser } from "@angular/common";


@Service()
export class httpAuth {
    private http = inject(HttpClient);
    private BASE_URL: string = environment.apiUrl
    private router = inject(Router)
    private platFormId = inject(PLATFORM_ID);      //Obtener el ID de angulaar para identificar SPAs oSSR

    currentUser$ = new BehaviorSubject<any>(null);
    currentToken$ = new BehaviorSubject<any>(null);


    loginUser(credentials: any) {
        //credential = { "email": "tati.garcia@dominio.com", "password": "OtraClaveDiferente456" }

        return this.http.post<any>(`${this.BASE_URL}/auth/login`, credentials)
            .pipe(
                //1.Tap permite ejecutar acciones secundarias.En este caso, guardas el token y los datos del usuario
                tap((res) => {
                    //Verificamos que la respuesta contenga las propiedades esperadas
                    if (res?.token && res?.data) {
                        this.saveDataLocalStorage(res.token, res.data)

                        //Redirecciona
                        this.router.navigateByUrl('/dashboard');

                    }
                }),
                //2.map muta o transforma el valor que viene del usuario.En este caso, extraemos el mensaje de la 
                map((res) => {
                    return res.msg
                }),

                //3. catchError intercepta respuestas con estado 400, 401, 500, ETC
                catchError((error: HttpErrorResponse) => {
                    console.error(error.error.msg)

                    //3.Extraemos el mensaje de la propiedad error
                    const errMsg = error.error?.msg || 'Error al iniciar secion'

                    return of(errMsg)     //of() sirve para devolver un nuevo Observable que emite el valor pasado
                })
            )
    }

    saveDataLocalStorage(token: any, user: any) {
        //Verificando el tipo de aplicacion que estamos ejecutando (SSR o SPA)
        if (isPlatformBrowser(this.platFormId)) {
            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify(user));
        }

        this.currentUser$.next(user);     //Guardando /persistir Datos en el behaviorSubject
        this.currentToken$.next(token);
    }

    getDataLocalStorage(): any {
        let token;
        let user;

        // Verificando el tipo de aplicacion que estamos ejecutando (SSR o SPA)
        if (isPlatformBrowser(this.platFormId)) {
            const valueKeyToken = localStorage.getItem('token');
            token = valueKeyToken ? valueKeyToken : null;

            const valueKeyUser = localStorage.getItem('user');
            user = valueKeyUser ? JSON.parse(valueKeyUser) : null;

            this.currentToken$.next(token);     // Actualizamos el token en el BehaviorSubject
            this.currentUser$.next(user);       // Actualizamos el usuario en el BehaviorSubject

            return {
                token,
                user
            }
        }
    }

    deleteDateLocalStorage() {
        //Verificando el tipo de aplicacion que estamos ejecutando (SSR o SPA)
        if( isPlatformBrowser( this.platFormId) ) {
            localStorage.removeItem( 'token' );
            localStorage.removeItem( 'user' );
        }
        this.currentToken$.next(null);
        this.currentToken$.next(null);
    }

    logoutUser() {
        this.deleteDateLocalStorage();
        this.router.navigateByUrl( '/login');        //Redireccionamos
    }

    isLogged(): boolean {
        // return !!this.currentToken$.value && !!this.currentToken$.value;
        const { token, user} = this.getDataLocalStorage();

        return !!token && !!user;
    }
}
