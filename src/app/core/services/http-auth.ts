import { HttpClient, HttpErrorResponse } from "@angular/common/http";
import { inject, PLATFORM_ID, Service } from "@angular/core";
import { Router } from "@angular/router";

import { BehaviorSubject, catchError, map, of, tap } from "rxjs";

import { environment } from "../../../environments/environment";
import { isPlatformBrowser } from "@angular/common";


@Service()
export class httpAuth {

    private readonly TOKEN_KEY = 'token';
    private readonly USER_KEY = 'user';

    private http = inject(HttpClient);
    private BASE_URL: string = environment.apiUrl
    private router = inject(Router)
    private platFormId = inject(PLATFORM_ID);      //Obtener el ID de angulaar para identificar SPAs oSSR
    private isBrowser: boolean = isPlatformBrowser(this.platFormId);


    currentUser$ = new BehaviorSubject<any>(this.getUserFromStorage());
    user$ = this.currentUser$.asObservable();
    currentToken$ = new BehaviorSubject<any>(this.getTokenFromStorage());
    token$ = this.currentToken$.asObservable();

    loginUser(credentials: any) {
        //credential = { "email": "tati.garcia@dominio.com", "password": "OtraClaveDiferente456" }

        return this.http.post<any>(`${this.BASE_URL}/auth/login`, credentials)
            .pipe(
                //1.Tap permite ejecutar acciones secundarias.En este caso, guardas el token y los datos del usuario
                tap((res) => {
                    //Verificamos que la respuesta contenga las propiedades esperadas
                    if (res?.token && res?.data) {
                  
                        this.setAuthData(res.token, res.data);
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

    registerUser(data: any) {
        // data = { name, nickname, email, password }

        return this.http.post<any>(`${this.BASE_URL}/auth/register`, data)
    }

    setAuthData( token: string | null, user: any ) {
        this.token = token;
        this.user = user;
    }

    getDataLocalStorage(): any {
        let token;
        let user;

        // Verificando el tipo de aplicacion que estamos ejecutando (SSR o SPA)
        if (this.isBrowser) {
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

    clearAuthData() {
        this.token = null;
        this.user = null;
    }

    logoutUser(): void {
        this.clearAuthData();
        //this.router.navigateByUrl( '/login');        //Redireccionamos
    }

    isLogged(): boolean {
        return !!this.token && !!this.user;
    }

    getTokenFromStorage(): string | null {
        if (this.isBrowser) {
            return localStorage.getItem("token")
        }
        return null;
    }

    getUserFromStorage(): string | null {
        if (this.isBrowser) {
            const user = localStorage.getItem("user")
            return user ? JSON.parse(user) : null;
        }
        return null;
    }

    //GETTERS Y SETTERS

    set token(token: string | null) {
        if (this.isBrowser) {
            if(token){
                localStorage.setItem(this.TOKEN_KEY, token);
            } else {
                localStorage.removeItem(this.TOKEN_KEY)
            }
        }

        this.currentToken$.next(token);
        console.log('[seter token]:', token);
    }

    set user(user: any) {
        if (this.isBrowser) {
            if(user) {
                localStorage.setItem(this.USER_KEY, JSON.stringify(user));
            } else {
                localStorage.removeItem(this.USER_KEY)
            }
        }

        this.currentUser$.next(user);
        console.log(user)
    }

    //Getters para ontener el valor actual sincronicamnete
    get token(): string | null {
        return this.currentToken$.getValue();
    }

    get user(): any {
        return this.currentUser$.getValue();
    }
}
