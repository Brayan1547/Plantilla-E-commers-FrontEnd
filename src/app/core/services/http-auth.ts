import { HttpClient, HttpErrorResponse } from "@angular/common/http";
import { inject, PLATFORM_ID, Service } from "@angular/core";
import { Router } from "@angular/router";

import { BehaviorSubject, catchError, finalize, map, Observable, of, shareReplay, tap } from "rxjs";

import { environment } from "../../../environments/environment";
import { isPlatformBrowser } from "@angular/common";


@Service()
export class HttpAuth {

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

    /**
     * Peticion `GET /auth/renew-token` en vuelo, compartida entre suscriptores
     * concurrentes. Se libera al completar (ver `checkAuthStatus`).
     */
    private renewInFlight$?: Observable<boolean>;

    loginUser(credentials: any, returnUrl?: string | null) {
        //credential = { "email": "tati.garcia@dominio.com", "password": "OtraClaveDiferente456" }

        return this.http.post<any>(`${this.BASE_URL}/auth/login`, credentials)
            .pipe(
                //1.Tap permite ejecutar acciones secundarias.En este caso, guardas el token y los datos del usuario
                tap((res) => {
                    //Verificamos que la respuesta contenga las propiedades esperadas
                    if (res?.token && res?.data) {

                        this.setAuthData(res.token, res.data);

                        // Redirecciona segun rol + returnUrl (si es una ruta interna segura).
                        this.router.navigateByUrl(
                            this.resolvePostLoginUrl(res.data?.role, returnUrl),
                        );
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

    /**
     * Destino tras un login correcto.
     *  - administrador / shop_manager / editor: `returnUrl` si es una ruta
     *    interna segura; en caso contrario `/admin`. (F3: el rol `editor` YA
     *    tiene panel — su UI editorial de productos vive en `/admin`.)
     *  - subscriber: siempre `/home` (no tiene panel).
     */
    private resolvePostLoginUrl(role: string | undefined, returnUrl?: string | null): string {
        const isPanelRole = role === 'administrador' || role === 'shop_manager' || role === 'editor';
        if (isPanelRole) {
            return this.safeInternalUrl(returnUrl) ?? '/admin';
        }
        return '/home';
    }

    /**
     * Acepta SOLO rutas internas absolutas ("/algo"). Rechaza URLs absolutas
     * (`http://evil.com`), protocol-relative (`//evil.com`) y backslashes,
     * para que `returnUrl` no pueda usarse como open redirect.
     */
    private safeInternalUrl(raw?: string | null): string | null {
        if (!raw || typeof raw !== 'string') return null;
        if (!raw.startsWith('/')) return null;
        if (raw.startsWith('//') || raw.startsWith('/\\')) return null;
        if (raw.includes('://')) return null;
        return raw;
    }


    checkAuthStatus(): Observable<boolean> {
        const token = this.token;

        //validar si el token existe
        if( !token ) {
            this.clearAuthData();       //Eliminar las propiedades del localstorage
            return of( false );
        }

        // Coalescing de la peticion en vuelo. En una carga fria de /admin,
        // adminGuard + adminChildGuard (este ultimo se evalua dos veces por el
        // redirect '' -> 'overview') llaman a checkAuthStatus() casi a la vez:
        // sin esto se disparan 3x GET /auth/renew-token. Compartimos la misma
        // peticion y la liberamos al completar, de modo que cada NAVEGACION
        // posterior sigue revalidando la sesion contra el backend.
        if ( this.renewInFlight$ ) {
            return this.renewInFlight$;
        }

        this.renewInFlight$ = this.http.get<any>(`${this.BASE_URL}/auth/renew-token`).pipe(
            tap( ( res ) => {
                if ( res?.token && res?.data ) {
                    this.setAuthData(res.token, res.data );
                }
            }),
            map( ( res ) => !!res.token ),
            catchError( () => {
                this.clearAuthData();       //Eliminar las propiedades del localStorage
                return of(false);
            } ),
            finalize( () => { this.renewInFlight$ = undefined; } ),
            shareReplay( { bufferSize: 1, refCount: false } ),
        );

        return this.renewInFlight$;
    }

    setAuthData(token: string | null, user: any) {
        this.token = token;
        this.user = user;
    }

    getDataLocalStorage(): any {
        let token;
        let user;

        // Verificando el tipo de aplicacion que estamos ejecutando (SSR o SPA)
        if (this.isBrowser) {
            const valueKeyToken = sessionStorage.getItem('token');
            token = valueKeyToken ? valueKeyToken : null;

            const valueKeyUser = sessionStorage.getItem('user');
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
            return sessionStorage.getItem("token")
        }
        return null;
    }

    getUserFromStorage(): string | null {
        if (this.isBrowser) {
            const user = sessionStorage.getItem("user")
            return user ? JSON.parse(user) : null;
        }
        return null;
    }

    //GETTERS Y SETTERS

    set token(token: string | null) {
        if (this.isBrowser) {
            if (token) {
                sessionStorage.setItem(this.TOKEN_KEY, token);
            } else {
                sessionStorage.removeItem(this.TOKEN_KEY)
            }
        }

        this.currentToken$.next(token);
    }

    set user(user: any) {
        if (this.isBrowser) {
            if (user) {
                sessionStorage.setItem(this.USER_KEY, JSON.stringify(user));
            } else {
                sessionStorage.removeItem(this.USER_KEY)
            }
        }

        this.currentUser$.next(user);
    }

    //Getters para ontener el valor actual sincronicamnete
    get token(): string | null {
        return this.currentToken$.getValue();
    }

    get user(): any {
        return this.currentUser$.getValue();
    }
}
